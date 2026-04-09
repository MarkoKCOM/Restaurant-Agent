import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  addToWaitlist,
  listWaitlist,
  offerSlot,
  acceptOffer,
  cancelWaitlistEntry,
  expireStaleOffers,
} from "../services/waitlist.service.js";
import { db } from "../db/index.js";
import { waitlist } from "../db/schema.js";
import { enforceTenant, resolveRestaurantId } from "../middleware/auth.js";

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
    const user = request.user;

    if (user) {
      const err = enforceTenant(user, parsed.restaurantId!);
      if (err) {
        return reply.status(403).send({ error: err });
      }
    }

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
  app.get("/", async (request, reply) => {
    const { restaurantId, date } = request.query as {
      restaurantId?: string;
      date?: string;
    };

    if (restaurantId) {
      const err = enforceTenant(request.user!, restaurantId);
      if (err) {
        return reply.status(403).send({ error: err });
      }
    }

    const scopedRestaurantId = resolveRestaurantId(request.user!, restaurantId);
    if (!scopedRestaurantId) {
      return { waitlist: [] };
    }

    await expireStaleOffers();

    const entries = await listWaitlist(scopedRestaurantId, date);
    return { waitlist: entries };
  });

  // POST /:id/offer — offer a slot to a waitlist entry
  app.post("/:id/offer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [waitlistRow] = await db
      .select({ restaurantId: waitlist.restaurantId })
      .from(waitlist)
      .where(eq(waitlist.id, id))
      .limit(1);

    if (!waitlistRow) {
      reply.code(404);
      return { error: "Waitlist entry not found" };
    }

    const err = enforceTenant(request.user!, waitlistRow.restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

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
    const [waitlistRow] = await db
      .select({ restaurantId: waitlist.restaurantId })
      .from(waitlist)
      .where(eq(waitlist.id, id))
      .limit(1);

    if (!waitlistRow) {
      reply.code(404);
      return { error: "Waitlist entry not found or not in offered state" };
    }

    const user = request.user;
    if (user) {
      const err = enforceTenant(user, waitlistRow.restaurantId);
      if (err) {
        return reply.status(403).send({ error: err });
      }
    }

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
    const [waitlistRow] = await db
      .select({ restaurantId: waitlist.restaurantId })
      .from(waitlist)
      .where(eq(waitlist.id, id))
      .limit(1);

    if (!waitlistRow) {
      reply.code(404);
      return { error: "Waitlist entry not found" };
    }

    const err = enforceTenant(request.user!, waitlistRow.restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const entry = await cancelWaitlistEntry(id);
    if (!entry) {
      reply.code(404);
      return { error: "Waitlist entry not found" };
    }
    return { waitlistEntry: entry };
  });
}
