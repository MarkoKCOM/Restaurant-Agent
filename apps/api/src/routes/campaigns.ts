import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";
import { previewCampaignAudience } from "../services/campaign.service.js";

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
  });
}

export async function campaignRoutes(app: FastifyInstance) {
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
}
