import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  logVisit,
  getVisitHistory,
  getGuestInsights,
} from "../services/visit.service.js";
import {
  submitFeedback,
  getFeedbackSummary,
} from "../services/feedback.service.js";
import {
  getFullGuestProfile,
  autoTagGuest,
  getGuestById,
} from "../services/guest.service.js";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";

function sendVisitError(
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
    "Visit request rejected",
  );

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

function sendCaughtVisitError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Visit operation failed";
  request.log.warn(
    {
      ...context,
      err: error,
      code,
      requestId: request.id,
      userId: request.user?.id,
      restaurantId: request.user?.restaurantId,
      role: request.user?.role,
    },
    "Visit operation failed",
  );

  return reply.status(400).send({
    error: message,
    code,
    requestId: request.id,
  });
}

const logVisitSchema = z.object({
  guestId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  partySize: z.coerce.number().int().min(1).max(50).optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        category: z.string(),
        price: z.number().optional(),
        rating: z.number().min(1).max(5).optional(),
      }),
    )
    .optional(),
  totalSpend: z.coerce.number().int().min(0).optional(),
  feedback: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  occasion: z.string().optional(),
  dietaryNotes: z
    .object({
      vegetarian: z.boolean().optional(),
      vegan: z.boolean().optional(),
      glutenFree: z.boolean().optional(),
      allergies: z.array(z.string()).optional(),
      kosher: z.string().optional(),
      other: z.string().optional(),
    })
    .optional(),
  staffNotes: z.string().optional(),
  channel: z.enum(["whatsapp", "web", "sms"]).optional(),
});

const submitFeedbackSchema = z.object({
  guestId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  feedback: z.string().optional(),
  channel: z.enum(["whatsapp", "web", "sms"]),
});

export async function visitRoutes(app: FastifyInstance) {
  // POST /api/v1/visits — log a visit
  app.post("/", async (request, reply) => {
    const parsed = logVisitSchema.parse(request.body);
    const guest = await getGuestById(parsed.guestId);
    if (!guest) {
      return sendVisitError(request, reply, 404, "Guest not found", "VISIT_GUEST_NOT_FOUND", {
        guestId: parsed.guestId,
        restaurantId: parsed.restaurantId,
      });
    }
    if (guest.restaurantId !== parsed.restaurantId) {
      return sendVisitError(request, reply, 404, "Guest not found for restaurant", "VISIT_GUEST_RESTAURANT_MISMATCH", {
        guestId: parsed.guestId,
        restaurantId: parsed.restaurantId,
        guestRestaurantId: guest.restaurantId,
      });
    }

    const err = enforceTenant(request.user!, parsed.restaurantId!) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendVisitError(request, reply, 403, err, "VISIT_FORBIDDEN", {
        guestId: parsed.guestId,
        restaurantId: parsed.restaurantId,
      });
    }

    let visit;
    try {
      visit = await logVisit({
        guestId: parsed.guestId!,
        restaurantId: parsed.restaurantId!,
        reservationId: parsed.reservationId,
        date: parsed.date!,
        partySize: parsed.partySize,
        totalSpend: parsed.totalSpend,
        feedback: parsed.feedback,
        rating: parsed.rating,
        occasion: parsed.occasion,
        dietaryNotes: parsed.dietaryNotes,
        staffNotes: parsed.staffNotes,
        items: parsed.items?.map((item) => ({
          name: item.name!,
          category: item.category!,
          price: item.price,
          rating: item.rating,
        })),
        channel: parsed.channel,
      });
    } catch (error: unknown) {
      return sendCaughtVisitError(request, reply, error, "VISIT_LOG_FAILED", {
        guestId: parsed.guestId,
        restaurantId: parsed.restaurantId,
        reservationId: parsed.reservationId,
      });
    }

    // Auto-tag guest after visit
    await autoTagGuest(parsed.guestId!).catch((error: unknown) => {
      request.log.warn(
        {
          err: error,
          restaurantId: parsed.restaurantId,
          guestId: parsed.guestId,
          visitId: visit.id,
        },
        "Auto-tag after visit failed",
      );
    });

    reply.code(201);
    return { visit };
  });

  // GET /api/v1/visits/:guestId — visit history
  app.get("/:guestId", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const { limit } = request.query as { limit?: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendVisitError(request, reply, 404, "Guest not found", "VISIT_GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendVisitError(request, reply, 403, err, "VISIT_FORBIDDEN", {
        guestId,
        restaurantId: guest.restaurantId,
      });
    }

    const visits = await getVisitHistory(guestId, limit ? parseInt(limit, 10) : 20);
    return { visits };
  });

  // GET /api/v1/visits/:guestId/insights — aggregated guest insights
  app.get("/:guestId/insights", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendVisitError(request, reply, 404, "Guest not found", "VISIT_GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendVisitError(request, reply, 403, err, "VISIT_FORBIDDEN", {
        guestId,
        restaurantId: guest.restaurantId,
      });
    }

    const insights = await getGuestInsights(guestId);
    return { insights };
  });
}

export async function feedbackRoutes(app: FastifyInstance) {
  // POST /api/v1/feedback — submit feedback (public — guests submit via widget/WhatsApp)
  app.post("/", async (request, reply) => {
    const parsed = submitFeedbackSchema.parse(request.body);
    const guest = await getGuestById(parsed.guestId);
    if (!guest) {
      return sendVisitError(request, reply, 404, "Guest not found", "FEEDBACK_GUEST_NOT_FOUND", {
        guestId: parsed.guestId,
        restaurantId: parsed.restaurantId,
      });
    }
    if (guest.restaurantId !== parsed.restaurantId) {
      return sendVisitError(
        request,
        reply,
        404,
        "Guest not found for restaurant",
        "FEEDBACK_GUEST_RESTAURANT_MISMATCH",
        { guestId: parsed.guestId, restaurantId: parsed.restaurantId, guestRestaurantId: guest.restaurantId },
      );
    }

    let result;
    try {
      result = await submitFeedback({
        guestId: parsed.guestId!,
        restaurantId: parsed.restaurantId!,
        reservationId: parsed.reservationId,
        rating: parsed.rating!,
        feedback: parsed.feedback,
        channel: parsed.channel!,
      }, {
        logger: request.log,
      });
    } catch (error: unknown) {
      return sendCaughtVisitError(request, reply, error, "FEEDBACK_SUBMIT_FAILED", {
        guestId: parsed.guestId,
        restaurantId: parsed.restaurantId,
        reservationId: parsed.reservationId,
      });
    }

    // Auto-tag guest after feedback
    await autoTagGuest(parsed.guestId!).catch((error: unknown) => {
      request.log.warn(
        {
          err: error,
          restaurantId: parsed.restaurantId,
          guestId: parsed.guestId,
          reservationId: parsed.reservationId,
          visitId: result?.id,
        },
        "Auto-tag after feedback failed",
      );
    });

    reply.code(201);
    return { visit: result };
  });

  // GET /api/v1/feedback/summary — restaurant feedback summary (requires auth)
  app.get("/summary", async (request, reply) => {
    if (!request.user) {
      return sendVisitError(request, reply, 401, "Unauthorized", "FEEDBACK_UNAUTHORIZED");
    }

    const { restaurantId, from, to } = request.query as {
      restaurantId: string;
      from?: string;
      to?: string;
    };

    if (!restaurantId) {
      return sendVisitError(request, reply, 400, "restaurantId is required", "RESTAURANT_ID_REQUIRED");
    }

    const err = enforceTenant(request.user, restaurantId);
    if (err) {
      return sendVisitError(request, reply, 403, err, "FEEDBACK_FORBIDDEN", { restaurantId });
    }

    const summary = await getFeedbackSummary(restaurantId, { from, to });
    return { summary };
  });
}
