import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  listEngagementJobs,
  checkAnniversaries,
  checkBirthdays,
  checkWinBack,
} from "../services/engagement.service.js";
import { listOutboundMessages } from "../services/outbound-message.service.js";
import { enforceTenant, requireGrowthPackage, requireRestaurantAdmin } from "../middleware/auth.js";

function sendEngagementError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
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
    ...extra,
  });
}

async function enforceEngagementAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  restaurantId: string,
) {
  const accessError = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
  if (accessError) {
    sendEngagementError(request, reply, 403, accessError, "ENGAGEMENT_FORBIDDEN", { restaurantId });
    return true;
  }

  const packageAccess = await requireGrowthPackage(restaurantId);
  if (!packageAccess.ok) {
    sendEngagementError(
      request,
      reply,
      packageAccess.code === "RESTAURANT_NOT_FOUND" ? 404 : 403,
      packageAccess.error ?? "Growth package required",
      packageAccess.code ?? "PACKAGE_GROWTH_REQUIRED",
      { restaurantId, restaurantPackage: packageAccess.restaurantPackage, requiredPackage: "growth" },
      { restaurantId, restaurantPackage: packageAccess.restaurantPackage, requiredPackage: "growth" },
    );
    return true;
  }

  return false;
}

export async function engagementRoutes(app: FastifyInstance) {
  // GET /outbound-messages — inspect recently logged outbound WhatsApp messages
  app.get("/outbound-messages", async (request, reply) => {
    const { restaurantId, status, messageType, limit } = request.query as {
      restaurantId?: string;
      status?: string;
      messageType?: string;
      limit?: string;
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

    const accessError = await enforceEngagementAccess(request, reply, restaurantId);
    if (accessError) return reply;

    try {
      const parsedLimit = limit ? Number(limit) : undefined;
      const messages = await listOutboundMessages({
        restaurantId,
        status,
        messageType,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      });
      return { messages };
    } catch (error: unknown) {
      return sendEngagementError(
        request,
        reply,
        500,
        "Outbound message list failed",
        "OUTBOUND_MESSAGES_LIST_FAILED",
        { err: error, restaurantId, status, messageType },
      );
    }
  });

  // GET /jobs — list engagement jobs with optional filters
  app.get("/jobs", async (request, reply) => {
    const { restaurantId, guestId, status, messageCategory, limit } = request.query as {
      restaurantId?: string;
      guestId?: string;
      status?: string;
      messageCategory?: "transactional" | "promotional";
      limit?: string;
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

    const accessError = await enforceEngagementAccess(request, reply, restaurantId);
    if (accessError) return reply;

    try {
      const parsedLimit = limit ? Number(limit) : undefined;
      const jobs = await listEngagementJobs({
        restaurantId,
        guestId,
        status,
        messageCategory,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      });
      return { jobs };
    } catch (error: unknown) {
      return sendEngagementError(
        request,
        reply,
        500,
        "Engagement job list failed",
        "ENGAGEMENT_JOBS_LIST_FAILED",
        { err: error, restaurantId, guestId, status, messageCategory },
      );
    }
  });

  // POST /birthdays/check — manually trigger birthday greeting check for a restaurant
  app.post("/birthdays/check", async (request, reply) => {
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

    const accessError = await enforceEngagementAccess(request, reply, restaurantId);
    if (accessError) return reply;

    try {
      const result = await checkBirthdays(restaurantId, { logger: request.log, source: "manual_birthday_check" });
      return { result };
    } catch (error: unknown) {
      return sendEngagementError(
        request,
        reply,
        500,
        "Birthday check failed",
        "BIRTHDAY_CHECK_FAILED",
        { err: error, restaurantId },
      );
    }
  });

  // POST /anniversaries/check — manually trigger first-visit anniversary check for a restaurant
  app.post("/anniversaries/check", async (request, reply) => {
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

    const accessError = await enforceEngagementAccess(request, reply, restaurantId);
    if (accessError) return reply;

    try {
      const result = await checkAnniversaries(restaurantId, { logger: request.log, source: "manual_anniversary_check" });
      return { result };
    } catch (error: unknown) {
      return sendEngagementError(
        request,
        reply,
        500,
        "Anniversary check failed",
        "ANNIVERSARY_CHECK_FAILED",
        { err: error, restaurantId },
      );
    }
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

    const accessError = await enforceEngagementAccess(request, reply, restaurantId);
    if (accessError) return reply;

    try {
      const result = await checkWinBack(restaurantId, { logger: request.log, source: "manual_win_back_check" });
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
