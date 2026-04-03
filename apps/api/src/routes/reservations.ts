import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { reservations, guests, tables } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

const createReservationSchema = z.object({
  restaurantId: z.string().uuid(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
  notes: z.string().optional(),
  source: z.enum(["whatsapp", "web", "walk_in", "phone"]).default("web"),
});

const availabilityQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
});

export async function reservationRoutes(app: FastifyInstance) {
  // GET /availability
  app.get("/availability", async (request, reply) => {
    const query = availabilityQuerySchema.parse(request.query);
    // TODO: implement availability check against table map + existing reservations
    return { slots: [], query };
  });

  // POST / — create reservation
  app.post("/", async (request, reply) => {
    const body = createReservationSchema.parse(request.body);
    // TODO: find or create guest, check availability, assign table, create reservation
    return { message: "reservation created", body };
  });

  // GET / — list reservations
  app.get("/", async (request, reply) => {
    const { restaurantId, date } = request.query as {
      restaurantId?: string;
      date?: string;
    };
    // TODO: query reservations with filters
    return { reservations: [], filters: { restaurantId, date } };
  });

  // PATCH /:id — update reservation
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: validate changes, update reservation
    return { message: "reservation updated", id };
  });

  // DELETE /:id — cancel reservation
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: mark cancelled, free table, check waitlist
    return { message: "reservation cancelled", id };
  });
}
