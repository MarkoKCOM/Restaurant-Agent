import type { FastifyInstance } from "fastify";
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
    const err = enforceTenant(request.user!, parsed.restaurantId!) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const visit = await logVisit({
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

    // Auto-tag guest after visit
    await autoTagGuest(parsed.guestId!).catch((err) => {
      console.warn("Auto-tag after visit failed:", err);
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
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const visits = await getVisitHistory(guestId, limit ? parseInt(limit, 10) : 20);
    return { visits };
  });

  // GET /api/v1/visits/:guestId/insights — aggregated guest insights
  app.get("/:guestId/insights", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const insights = await getGuestInsights(guestId);
    return { insights };
  });
}

export async function feedbackRoutes(app: FastifyInstance) {
  // POST /api/v1/feedback — submit feedback (public — guests submit via widget/WhatsApp)
  app.post("/", async (request, reply) => {
    const parsed = submitFeedbackSchema.parse(request.body);
    const result = await submitFeedback({
      guestId: parsed.guestId!,
      restaurantId: parsed.restaurantId!,
      reservationId: parsed.reservationId,
      rating: parsed.rating!,
      feedback: parsed.feedback,
      channel: parsed.channel!,
    });

    // Auto-tag guest after feedback
    await autoTagGuest(parsed.guestId!).catch((err) => {
      console.warn("Auto-tag after feedback failed:", err);
    });

    reply.code(201);
    return { visit: result };
  });

  // GET /api/v1/feedback/summary — restaurant feedback summary (requires auth)
  app.get("/summary", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { restaurantId, from, to } = request.query as {
      restaurantId: string;
      from?: string;
      to?: string;
    };

    if (!restaurantId) {
      return reply.status(400).send({ error: "restaurantId is required" });
    }

    const err = enforceTenant(request.user, restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const summary = await getFeedbackSummary(restaurantId, { from, to });
    return { summary };
  });
}
