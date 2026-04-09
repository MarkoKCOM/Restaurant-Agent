import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createGuestSchema } from "@openseat/domain";
import {
  findOrCreateGuest,
  getGuestById,
  listGuests,
  toDomainGuest,
  updateGuestPreferences,
  getFullGuestProfile,
  autoTagGuest,
} from "../services/guest.service.js";
import { getGuestSentimentHistory } from "../services/feedback.service.js";
import { db } from "../db/index.js";
import { reservations } from "../db/schema.js";

const updateGuestSchema = z.object({
  preferences: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function guestRoutes(app: FastifyInstance) {
  // GET / — list guests
  app.get("/", async (request) => {
    const { restaurantId } = request.query as { restaurantId?: string };
    const rows = await listGuests({ restaurantId });
    const guests = rows.map(toDomainGuest);
    return { guests };
  });

  // GET /:id — guest profile (with optional reservation history)
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { includeHistory } = request.query as { includeHistory?: string };
    const row = await getGuestById(id);

    if (!row) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const guest = toDomainGuest(row);

    if (includeHistory === "true") {
      const guestReservations = await db
        .select()
        .from(reservations)
        .where(eq(reservations.guestId, id))
        .orderBy(desc(reservations.date), desc(reservations.timeStart))
        .limit(20);

      return { guest, reservations: guestReservations };
    }

    return { guest };
  });

  // POST / — create or find guest
  app.post("/", async (request, reply) => {
    const body = createGuestSchema.parse(request.body);
    const row = await findOrCreateGuest(body);
    reply.code(201);
    return { guest: toDomainGuest(row) };
  });

  // GET /:id/full-profile — mega profile for WhatsApp bot
  app.get("/:id/full-profile", async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await getFullGuestProfile(id);

    if (!profile) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    return { profile };
  });

  // GET /:id/sentiment — sentiment history
  app.get("/:id/sentiment", async (request) => {
    const { id } = request.params as { id: string };
    const history = await getGuestSentimentHistory(id);
    return { history };
  });

  // POST /:id/auto-tag — recalculate and apply auto tags
  app.post("/:id/auto-tag", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tags = await autoTagGuest(id);

    if (!tags) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    return { tags };
  });

  // PATCH /:id — update guest preferences
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGuestSchema.parse(request.body ?? {});

    const updated = await updateGuestPreferences(id, body);
    if (!updated) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    return { guest: toDomainGuest(updated) };
  });
}
