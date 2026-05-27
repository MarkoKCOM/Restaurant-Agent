import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";
import {
  getCampaignRoiAnalytics,
  getClvAnalytics,
  getLoyaltyAnalytics,
  getReservationAnalytics,
  getRetentionAnalytics,
} from "../services/analytics.service.js";
import { formatMorningSummaryMessage, getMorningSummary } from "../services/summary.service.js";

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

function sendAnalyticsError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
) {
  request.log.warn(
    {
      ...context,
      code,
      requestId: request.id,
      statusCode,
      userId: request.user?.id,
      restaurantId: request.user?.restaurantId,
      role: request.user?.role,
    },
    "Analytics request rejected",
  );

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
    ...context,
  });
}

function enforceAnalyticsAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  restaurantId: string,
) {
  const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
  if (err) {
    return sendAnalyticsError(request, reply, 403, err, "ANALYTICS_FORBIDDEN", { restaurantId });
  }
  return null;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/reservations", async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query ?? {});
    const accessError = enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

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
  });

  app.get("/retention", async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query ?? {});
    const accessError = enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

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
  });

  app.get("/loyalty", async (request, reply) => {
    const query = analyticsQuerySchema.parse(request.query ?? {});
    const accessError = enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

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
  });

  app.get("/daily-morning-summary", async (request, reply) => {
    const query = morningSummaryQuerySchema.parse(request.query ?? {});
    const accessError = enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

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
      },
      "Daily morning summary preview generated",
    );
    return { summary, message };
  });

  app.get("/clv", async (request, reply) => {
    const query = clvQuerySchema.parse(request.query ?? {});
    const accessError = enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

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
  });

  app.get("/campaign-roi", async (request, reply) => {
    const query = campaignRoiQuerySchema.parse(request.query ?? {});
    const accessError = enforceAnalyticsAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

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
  });
}
