import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  availabilityQuerySchema,
  createReservationSchema,
} from "@openseat/domain";
import {
  cancelReservation,
  checkAvailability,
  createReservation,
  listReservations,
  markNoShow,
  updateReservation,
} from "../services/reservation.service.js";

const updateReservationSchema = z.object({
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  timeStart: z.string().regex(/^[0-9]{2}:[0-9]{2}$/).optional(),
  partySize: z.coerce.number().int().min(1).max(50).optional(),
  status: z
    .enum(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"])
    .optional(),
  notes: z.string().optional(),
  tableIds: z.array(z.string().uuid()).optional(),
  cancellationReason: z.string().nullable().optional(),
});

export async function reservationRoutes(app: FastifyInstance) {
  // GET /availability
  app.get("/availability", async (request) => {
    const query = availabilityQuerySchema.parse(request.query);
    const slots = await checkAvailability(query);
    return { slots };
  });

  // POST / — create reservation
  app.post("/", async (request, reply) => {
    const body = createReservationSchema.parse(request.body);
    const reservation = await createReservation(body);
    reply.code(201);
    return { reservation };
  });

  // GET / — list reservations
  app.get("/", async (request) => {
    const { restaurantId, date } = request.query as {
      restaurantId?: string;
      date?: string;
    };

    const reservations = await listReservations({ restaurantId, date });
    return { reservations };
  });

  // PATCH /:id — update reservation
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateReservationSchema.parse(request.body);

    const updated = await updateReservation(id, body);
    if (!updated) {
      reply.code(404);
      return { error: "Reservation not found" };
    }

    return { reservation: updated };
  });

  // POST /:id/no-show — mark reservation as no-show
  app.post("/:id/no-show", async (request, reply) => {
    const { id } = request.params as { id: string };

    const reservation = await markNoShow(id);
    if (!reservation) {
      reply.code(404);
      return { error: "Reservation not found" };
    }

    return { reservation };
  });

  // DELETE /:id — cancel reservation
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = (request.query ?? {}) as { reason?: string };

    const result = await cancelReservation(id, reason);
    if (!result) {
      reply.code(404);
      return { error: "Reservation not found" };
    }

    return {
      reservation: result.reservation,
      waitlistMatch: result.waitlistMatch,
    };
  });
}
