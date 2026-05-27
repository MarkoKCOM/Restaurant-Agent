import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { enforceTenant, requireGrowthPackage, requireRestaurantAdmin } from "../middleware/auth.js";
import {
  getCampaignRoiAnalytics,
  getClvAnalytics,
  getLoyaltyAnalytics,
  getReservationAnalytics,
  getRetentionAnalytics,
} from "../services/analytics.service.js";
import { formatMorningSummaryMessage, getMorningSummary } from "../services/summary.service.js";
import { recordOutboundDelivery } from "../services/outbound-message.service.js";

const analyticsQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const campaignRoiQuerySchema = analyticsQuerySchema.extend({
  campaignId: z.string().uuid().optional(),
  attributionDays: z.coerce.number().int().min(1).max(90).optional(),
  costPerMessage: z.coerce.number().min(0).max(100).optional(),
});

const clvQuerySchema = analyticsQuerySchema.extend({
  topLimit: z.coerce.number().int().min(1).max(50).optional(),
});

const morningSummaryQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const morningSummaryLogSchema = morningSummaryQuerySchema;

function sendAnalyticsError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
) {
  const responseContext = { ...context };
  delete responseContext.err;
  const logPayload = {
    ...context,
    code,
    requestId: request.id,
    statusCode,
    userId: request.user?.id,
    restaurantId: request.user?.restaurantId,
    role: request.user?.role,
  };

  if (statusCode >= 500) {
    request.log.error(logPayload, "Analytics request failed");
  } else {
    request.log.warn(logPayload, "Analytics request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
    ...responseContext,
  });
}

function sendCaughtAnalyticsError(
  request: FastifyRequest,
  reply: FastifyReply,
  err: unknown,
  fallbackCode: string,
  context: Record<string, unknown> = {},
) {
  const message = err instanceof Error ? err.message : "Analytics operation failed";
  if (message.includes("Restaurant not found")) {
    return sendAnalyticsError(request, reply, 404, message, "ANALYTICS_RESTAURANT_NOT_FOUND", context);
  }
  if (message.includes("date must") || message.includes("from date must")) {
    return sendAnalyticsError(request, reply, 400, message, "ANALYTICS_DATE_RANGE_INVALID", context);
  }
  return sendAnalyticsError(request, reply, 500, message, fallbackCode, {
    ...context,
    err,
  });
}

async function enforceAnalyticsAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  restaurantId: string,
) {
  const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
  if (err) {
    sendAnalyticsError(request, reply, 403, err, "ANALYTICS_FORBIDDEN", { restaurantId });
    return true;
  }

  const packageAccess = await requireGrowthPackage(restaurantId);
  if (!packageAccess.ok) {
    sendAnalyticsError(
      request,
      reply,
      packageAccess.code === "RESTAURANT_NOT_FOUND" ? 404 : 403,
      packageAccess.error ?? "Growth package required",
      packageAccess.code ?? "PACKAGE_GROWTH_REQUIRED",
      {
        restaurantId,
        restaurantPackage: packageAccess.restaurantPackage,
        requiredPackage: "growth",
      },
    );
    return true;
  }

  return false;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/reservations", async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return reply;

    try {
      const reservationAnalytics = await getReservationAnalytics(query);
      request.log.info(
        {
          restaurantId: query.restaurantId,
          requestId: request.id,
          bookings: reservationAnalytics.current.bookings,
          covers: reservationAnalytics.current.covers,
          cancellations: reservationAnalytics.current.cancellations,
          noShows: reservationAnalytics.current.noShows,
        },
        "Reservation analytics generated",
      );
      return { reservations: reservationAnalytics };
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_RESERVATIONS_FAILED", {
        restaurantId: query.restaurantId,
        surface: "reservations",
      });
    }
  });

  app.get("/retention", async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return reply;

    try {
      const retention = await getRetentionAnalytics(query);
      request.log.info(
        {
          restaurantId: query.restaurantId,
          requestId: request.id,
          uniqueGuests: retention.current.uniqueGuests,
          returningGuestRatio: retention.current.returningGuestRatio,
        },
        "Retention analytics generated",
      );
      return { retention };
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_RETENTION_FAILED", {
        restaurantId: query.restaurantId,
        surface: "retention",
      });
    }
  });

  app.get("/loyalty", async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return reply;

    try {
      const loyalty = await getLoyaltyAnalytics(query);
      request.log.info(
        {
          restaurantId: query.restaurantId,
          requestId: request.id,
          activeMembers: loyalty.activeMembers,
          pointsIssued: loyalty.pointsIssued,
          pointsRedeemed: loyalty.pointsRedeemed,
        },
        "Loyalty analytics generated",
      );
      return { loyalty };
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_LOYALTY_FAILED", {
        restaurantId: query.restaurantId,
        surface: "loyalty",
      });
    }
  });

  app.get("/daily-morning-summary", async (request, reply) => {
    const query = morningSummaryQuerySchema.parse(request.query ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return reply;

    try {
      const summary = await getMorningSummary(query);
      const message = formatMorningSummaryMessage(summary);
      request.log.info(
        {
          restaurantId: query.restaurantId,
          requestId: request.id,
          date: summary.summaryDate,
          yesterdayCovers: summary.yesterday.totalCovers,
          todayBookings: summary.today.totalReservations,
          todayCovers: summary.today.totalCovers,
          notableGuestCount: summary.notableGuests.length,
          alertCount: summary.alerts.length,
          ownerWhatsappConfigured: summary.ownerWhatsappConfigured,
          ownerRecipientConfigured: summary.ownerRecipientConfigured,
          ownerRecipientSource: summary.ownerRecipientSource,
        },
        "Daily morning summary preview generated",
      );
      return { summary, message };
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_MORNING_SUMMARY_FAILED", {
        restaurantId: query.restaurantId,
        date: query.date,
        surface: "daily-morning-summary",
      });
    }
  });

  app.post("/daily-morning-summary/log", async (request, reply) => {
    const parsed = morningSummaryLogSchema.parse(request.body ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, parsed.restaurantId);
    if (accessError) return reply;

    try {
      const summary = await getMorningSummary(parsed);
      const message = formatMorningSummaryMessage(summary);
      const outboundMessage = await recordOutboundDelivery({
        restaurantId: parsed.restaurantId,
        recipientMasked: summary.ownerRecipientMasked,
        messageType: "daily_morning_summary",
        messageCategory: "transactional",
        subjectType: "restaurant",
        subjectId: parsed.restaurantId,
        text: message,
        payload: {
          source: "analytics_preview_log",
          date: summary.summaryDate,
          yesterdayDate: summary.yesterdayDate,
          yesterdayCovers: summary.yesterday.totalCovers,
          todayBookings: summary.today.totalReservations,
          todayCovers: summary.today.totalCovers,
          notableGuestCount: summary.notableGuests.length,
          alertCount: summary.alerts.length,
          ownerWhatsappConfigured: summary.ownerWhatsappConfigured,
          ownerRecipientConfigured: summary.ownerRecipientConfigured,
          ownerRecipientSource: summary.ownerRecipientSource,
        },
      });
      request.log.info(
        {
          restaurantId: parsed.restaurantId,
          requestId: request.id,
          outboundMessageId: outboundMessage.id,
          date: summary.summaryDate,
          messageType: "daily_morning_summary",
        },
        "Daily morning summary outbound message logged",
      );
      return reply.status(201).send({ summary, message, outboundMessage });
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_MORNING_SUMMARY_LOG_FAILED", {
        restaurantId: parsed.restaurantId,
        date: parsed.date,
        surface: "daily-morning-summary-log",
      });
    }
  });

  app.get("/clv", async (request, reply) => {
    const query = clvQuerySchema.parse(request.query ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return reply;

    try {
      const clv = await getClvAnalytics(query);
      request.log.info(
        {
          restaurantId: query.restaurantId,
          requestId: request.id,
          guests: clv.totals.guests,
          lifetimeRevenue: clv.totals.lifetimeRevenue,
          averageLifetimeValue: clv.totals.averageLifetimeValue,
          topGuestCount: clv.topGuests.length,
        },
        "CLV analytics generated",
      );
      return { clv };
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_CLV_FAILED", {
        restaurantId: query.restaurantId,
        surface: "clv",
      });
    }
  });

  app.get("/campaign-roi", async (request, reply) => {
    const query = campaignRoiQuerySchema.parse(request.query ?? {});
    const accessError = await enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return reply;

    try {
      const campaignRoi = await getCampaignRoiAnalytics(query);
      request.log.info(
        {
          restaurantId: query.restaurantId,
          requestId: request.id,
          campaigns: campaignRoi.totals.campaigns,
          sent: campaignRoi.totals.sent,
          attributedReservations: campaignRoi.totals.attributedReservations,
          attributedRevenue: campaignRoi.totals.attributedRevenue,
        },
        "Campaign ROI analytics generated",
      );
      return { campaignRoi };
    } catch (err: unknown) {
      return sendCaughtAnalyticsError(request, reply, err, "ANALYTICS_CAMPAIGN_ROI_FAILED", {
        restaurantId: query.restaurantId,
        campaignId: query.campaignId,
        surface: "campaign-roi",
      });
    }
  });
}
