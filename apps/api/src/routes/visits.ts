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
} from "../services/guest.service.js";

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
    const body = logVisitSchema.parse(request.body) as Parameters<typeof logVisit>[0];
    const visit = await logVisit(body);

    // Auto-tag guest after visit
    await autoTagGuest(body.guestId).catch(() => {});

    reply.code(201);
    return { visit };
  });

  // GET /api/v1/visits/:guestId — visit history
  app.get("/:guestId", async (request) => {
    const { guestId } = request.params as { guestId: string };
    const { limit } = request.query as { limit?: string };
    const visits = await getVisitHistory(guestId, limit ? parseInt(limit, 10) : 20);
    return { visits };
  });

  // GET /api/v1/visits/:guestId/insights — aggregated guest insights
  app.get("/:guestId/insights", async (request) => {
    const { guestId } = request.params as { guestId: string };
    const insights = await getGuestInsights(guestId);
    return { insights };
  });
}

export async function feedbackRoutes(app: FastifyInstance) {
  // POST /api/v1/feedback — submit feedback
  app.post("/", async (request, reply) => {
    const body = submitFeedbackSchema.parse(request.body) as Parameters<typeof submitFeedback>[0];
    const result = await submitFeedback(body);

    // Auto-tag guest after feedback
    await autoTagGuest(body.guestId).catch(() => {});

    reply.code(201);
    return { visit: result };
  });

  // GET /api/v1/feedback/summary — restaurant feedback summary
  app.get("/summary", async (request) => {
    const { restaurantId, from, to } = request.query as {
      restaurantId: string;
      from?: string;
      to?: string;
    };

    if (!restaurantId) {
      return { error: "restaurantId is required" };
    }

    const summary = await getFeedbackSummary(restaurantId, { from, to });
    return { summary };
  });
}
