import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  listEngagementJobs,
  checkWinBack,
} from "../services/engagement.service.js";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";

function sendEngagementError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
) {
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
    request.log.error(logPayload, "Engagement request failed");
  } else {
    request.log.warn(logPayload, "Engagement request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

export async function engagementRoutes(app: FastifyInstance) {
  // GET /jobs — list engagement jobs with optional filters
  app.get("/jobs", async (request, reply) => {
    const { restaurantId, guestId, status, messageCategory } = request.query as {
      restaurantId?: string;
      guestId?: string;
      status?: string;
      messageCategory?: "transactional" | "promotional";
    };

    if (!restaurantId) {
      return sendEngagementError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendEngagementError(request, reply, 403, err, "ENGAGEMENT_FORBIDDEN", { restaurantId });
    }

    const jobs = await listEngagementJobs({ restaurantId, guestId, status, messageCategory });
    return { jobs };
  });

  // POST /win-back/check — manually trigger win-back check for a restaurant
  app.post("/win-back/check", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      return sendEngagementError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendEngagementError(request, reply, 403, err, "ENGAGEMENT_FORBIDDEN", { restaurantId });
    }

    try {
      const result = await checkWinBack(restaurantId);
      return { result };
    } catch (error: unknown) {
      return sendEngagementError(
        request,
        reply,
        500,
        "Win-back check failed",
        "WIN_BACK_CHECK_FAILED",
        { err: error, restaurantId },
      );
    }
  });
}
