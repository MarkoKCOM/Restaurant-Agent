import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";
import {
  createCampaign,
  deliverCampaign,
  getCampaignTemplates,
  previewCampaignAudience,
  previewCampaignSchedule,
  recordCampaignDeliveryEvent,
} from "../services/campaign.service.js";

const audienceFilterSchema = z.object({
  minVisits: z.coerce.number().int().min(0).optional(),
  maxVisits: z.coerce.number().int().min(0).optional(),
  lapsedDays: z.coerce.number().int().min(1).max(3650).optional(),
  tiers: z.array(z.enum(["bronze", "silver", "gold"])).optional(),
  tagsAny: z.array(z.string().min(1)).optional(),
  tagsAll: z.array(z.string().min(1)).optional(),
  minTotalSpend: z.coerce.number().int().min(0).optional(),
  maxTotalSpend: z.coerce.number().int().min(0).optional(),
  sources: z.array(z.enum(["whatsapp", "web", "walk_in", "referral", "telegram"])).optional(),
  languages: z.array(z.enum(["he", "en", "ar", "ru"])).optional(),
  includeOptedOut: z.boolean().optional(),
});

const audiencePreviewSchema = z.object({
  restaurantId: z.string().uuid(),
  filter: audienceFilterSchema.default({}),
  sampleLimit: z.coerce.number().int().min(0).max(50).optional(),
});

const schedulePreviewSchema = z.object({
  restaurantId: z.string().uuid(),
  scheduledAt: z.coerce.date().optional(),
  allowQuietHoursAdjustment: z.boolean().optional(),
});

const createCampaignSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  templateId: z.enum([
    "we_miss_you",
    "weekend_special",
    "new_menu_item",
    "birthday_month",
    "loyalty_milestone",
  ]).optional(),
  templateText: z.string().min(1),
  audienceFilter: audienceFilterSchema.default({}),
  scheduledAt: z.coerce.date().optional(),
  allowQuietHoursAdjustment: z.boolean().optional(),
});

const campaignParamsSchema = z.object({
  campaignId: z.string().uuid(),
});

const deliverySchema = z.object({
  restaurantId: z.string().uuid(),
});

const deliveryEventSchema = z.object({
  restaurantId: z.string().uuid(),
  guestId: z.string().uuid(),
  event: z.enum(["delivered", "read", "replied"]),
});

function sendCampaignError(
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
    "Campaign request rejected",
  );

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
    ...context,
  });
}

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/templates", async () => ({
    templates: getCampaignTemplates(),
  }));

  app.post("/audience-preview", async (request, reply) => {
    const parsed = audiencePreviewSchema.parse(request.body ?? {});
    const err = enforceTenant(request.user!, parsed.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendCampaignError(request, reply, 403, err, "CAMPAIGN_FORBIDDEN", {
        restaurantId: parsed.restaurantId,
      });
    }

    const preview = await previewCampaignAudience({
      restaurantId: parsed.restaurantId,
      filter: parsed.filter,
      sampleLimit: parsed.sampleLimit,
    });

    request.log.info(
      {
        restaurantId: parsed.restaurantId,
        requestId: request.id,
        matchedCount: preview.matchedCount,
        totalGuests: preview.totalGuests,
        excludedOptedOut: preview.excludedOptedOut,
        filtersApplied: preview.filtersApplied,
      },
      "Campaign audience preview generated",
    );

    return { preview };
  });

  app.post("/schedule-preview", async (request, reply) => {
    const parsed = schedulePreviewSchema.parse(request.body ?? {});
    const err = enforceTenant(request.user!, parsed.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendCampaignError(request, reply, 403, err, "CAMPAIGN_FORBIDDEN", {
        restaurantId: parsed.restaurantId,
      });
    }

    const schedule = await previewCampaignSchedule({
      restaurantId: parsed.restaurantId,
      scheduledAt: parsed.scheduledAt,
      allowQuietHoursAdjustment: parsed.allowQuietHoursAdjustment,
    });

    return { schedule };
  });

  app.post("/", async (request, reply) => {
    const parsed = createCampaignSchema.parse(request.body ?? {});
    const err = enforceTenant(request.user!, parsed.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendCampaignError(request, reply, 403, err, "CAMPAIGN_FORBIDDEN", {
        restaurantId: parsed.restaurantId,
      });
    }

    try {
      const result = await createCampaign({
        restaurantId: parsed.restaurantId,
        name: parsed.name,
        templateId: parsed.templateId,
        templateText: parsed.templateText,
        audienceFilter: parsed.audienceFilter,
        scheduledAt: parsed.scheduledAt,
        allowQuietHoursAdjustment: parsed.allowQuietHoursAdjustment,
      });

      request.log.info(
        {
          restaurantId: parsed.restaurantId,
          requestId: request.id,
          campaignId: result.campaign.id,
          status: result.campaign.status,
          scheduledAt: result.campaign.scheduledAt,
          templateId: parsed.templateId,
          variables: result.variables,
          scheduleWarnings: result.schedule.warnings.map((warning) => warning.code),
        },
        "Campaign created",
      );

      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Campaign creation failed";
      const schedule = err instanceof Error && "schedule" in err
        ? (err as Error & { schedule?: unknown }).schedule
        : undefined;
      if (message.includes("Unknown campaign personalization variables")) {
        return sendCampaignError(request, reply, 400, message, "CAMPAIGN_TEMPLATE_VARIABLE_UNKNOWN", {
          restaurantId: parsed.restaurantId,
        });
      }
      if (message.includes("schedule requires adjustment")) {
        return sendCampaignError(request, reply, 400, message, "CAMPAIGN_SCHEDULE_REQUIRES_ADJUSTMENT", {
          restaurantId: parsed.restaurantId,
          schedule,
        });
      }
      throw err;
    }
  });

  app.post("/:campaignId/deliver", async (request, reply) => {
    const params = campaignParamsSchema.parse(request.params ?? {});
    const parsed = deliverySchema.parse(request.body ?? {});
    const err = enforceTenant(request.user!, parsed.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendCampaignError(request, reply, 403, err, "CAMPAIGN_FORBIDDEN", {
        restaurantId: parsed.restaurantId,
        campaignId: params.campaignId,
      });
    }

    try {
      const result = await deliverCampaign({
        campaignId: params.campaignId,
        restaurantId: parsed.restaurantId,
      });

      request.log.info(
        {
          restaurantId: parsed.restaurantId,
          requestId: request.id,
          campaignId: params.campaignId,
          sent: result.delivery.sent,
          skipped: result.delivery.skipped,
          skippedOptedOut: result.delivery.skippedOptedOut,
          skippedRateLimitedWeek: result.delivery.skippedRateLimitedWeek,
          skippedRateLimitedMonth: result.delivery.skippedRateLimitedMonth,
        },
        "Campaign delivery triggered",
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Campaign delivery failed";
      if (message.includes("not found")) {
        return sendCampaignError(request, reply, 404, message, "CAMPAIGN_NOT_FOUND", {
          restaurantId: parsed.restaurantId,
          campaignId: params.campaignId,
        });
      }
      if (message.includes("cannot be delivered")) {
        return sendCampaignError(request, reply, 409, message, "CAMPAIGN_DELIVERY_STATUS_INVALID", {
          restaurantId: parsed.restaurantId,
          campaignId: params.campaignId,
        });
      }
      throw err;
    }
  });

  app.post("/:campaignId/delivery-events", async (request, reply) => {
    const params = campaignParamsSchema.parse(request.params ?? {});
    const parsed = deliveryEventSchema.parse(request.body ?? {});
    const err = enforceTenant(request.user!, parsed.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendCampaignError(request, reply, 403, err, "CAMPAIGN_FORBIDDEN", {
        restaurantId: parsed.restaurantId,
        campaignId: params.campaignId,
        guestId: parsed.guestId,
      });
    }

    try {
      const result = await recordCampaignDeliveryEvent({
        campaignId: params.campaignId,
        restaurantId: parsed.restaurantId,
        guestId: parsed.guestId,
        event: parsed.event,
      });

      request.log.info(
        {
          restaurantId: parsed.restaurantId,
          requestId: request.id,
          campaignId: params.campaignId,
          guestId: parsed.guestId,
          event: parsed.event,
          delivered: result.delivery.delivered,
          read: result.delivery.read,
          replied: result.delivery.replied,
        },
        "Campaign delivery event recorded",
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Campaign delivery event failed";
      if (message.includes("not found") && message.includes("recipient")) {
        return sendCampaignError(request, reply, 404, message, "CAMPAIGN_RECIPIENT_NOT_FOUND", {
          restaurantId: parsed.restaurantId,
          campaignId: params.campaignId,
          guestId: parsed.guestId,
        });
      }
      if (message.includes("not found")) {
        return sendCampaignError(request, reply, 404, message, "CAMPAIGN_NOT_FOUND", {
          restaurantId: parsed.restaurantId,
          campaignId: params.campaignId,
          guestId: parsed.guestId,
        });
      }
      throw err;
    }
  });
}
