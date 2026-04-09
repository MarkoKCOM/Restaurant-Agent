import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addToWaitlist,
  listWaitlist,
  offerSlot,
  acceptOffer,
  cancelWaitlistEntry,
  expireStaleOffers,
} from "../services/waitlist.service.js";

const addToWaitlistSchema = z.object({
  restaurantId: z.string().uuid(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(1),
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  preferredTimeStart: z.string().regex(/^[0-9]{2}:[0-9]{2}$/),
  preferredTimeEnd: z.string().regex(/^[0-9]{2}:[0-9]{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
});

export async function waitlistRoutes(app: FastifyInstance) {
  // POST / — add to waitlist
  app.post("/", async (request, reply) => {
    const parsed = addToWaitlistSchema.parse(request.body);
    const entry = await addToWaitlist({
      restaurantId: parsed.restaurantId!,
      guestName: parsed.guestName!,
      guestPhone: parsed.guestPhone!,
      date: parsed.date!,
      preferredTimeStart: parsed.preferredTimeStart!,
      preferredTimeEnd: parsed.preferredTimeEnd!,
      partySize: parsed.partySize!,
    });
    reply.code(201);
    return { waitlistEntry: entry };
  });

  // GET / — list waitlist entries
  app.get("/", async (request) => {
    const { restaurantId, date } = request.query as {
      restaurantId?: string;
      date?: string;
    };

    if (!restaurantId) {
      return { waitlist: [] };
    }

    // Expire stale offers first
    await expireStaleOffers();

    const entries = await listWaitlist(restaurantId, date);
    return { waitlist: entries };
  });

  // POST /:id/offer — offer a slot to a waitlist entry
  app.post("/:id/offer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await offerSlot(id);
    if (!entry) {
      reply.code(404);
      return { error: "Waitlist entry not found" };
    }
    return { waitlistEntry: entry };
  });

  // POST /:id/accept — accept offer and create reservation
  app.post("/:id/accept", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await acceptOffer(id);
    if (!result) {
      reply.code(404);
      return { error: "Waitlist entry not found or not in offered state" };
    }
    return {
      waitlistEntry: result.waitlistEntry,
      reservationId: result.reservationId,
    };
  });

  // DELETE /:id — cancel waitlist entry
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await cancelWaitlistEntry(id);
    if (!entry) {
      reply.code(404);
      return { error: "Waitlist entry not found" };
    }
    return { waitlistEntry: entry };
  });
}
