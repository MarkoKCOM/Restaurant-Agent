import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  availabilityQuerySchema,
  createReservationSchema,
  createWalkInSchema,
} from "@openseat/domain";
import { eq } from "drizzle-orm";
import {
  cancelReservation,
  checkAvailability,
  createReservation,
  createWalkIn,
  listReservations,
  markNoShow,
  updateReservation,
} from "../services/reservation.service.js";
import { db } from "../db/index.js";
import { reservations } from "../db/schema.js";
import { enforceTenant, requireOperationalRole, resolveRestaurantId } from "../middleware/auth.js";

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

function isReservationHttpError(err: unknown): err is Error & { statusCode: number } {
  return err instanceof Error && typeof (err as any).statusCode === "number";
}

export async function reservationRoutes(app: FastifyInstance) {
  // GET /availability
  app.get("/availability", async (request) => {
    const query = availabilityQuerySchema.parse(request.query) as Parameters<typeof checkAvailability>[0];
    const slots = await checkAvailability(query);
    return { slots };
  });

  // POST / — create reservation
  app.post("/", async (request, reply) => {
    const body = createReservationSchema.parse(request.body) as Parameters<typeof createReservation>[0];

    try {
      const reservation = await createReservation(body);
      reply.code(201);
      return { reservation };
    } catch (err) {
      if (isReservationHttpError(err)) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /walk-in — owner walk-in creation (authenticated)
  app.post("/walk-in", async (request, reply) => {
    const body = createWalkInSchema.parse(request.body);
    const user = request.user!;

    const err = requireOperationalRole(user) ?? enforceTenant(user, body.restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const reservation = await createWalkIn(body);
      reply.code(201);
      return { reservation };
    } catch (error) {
      if (isReservationHttpError(error)) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // GET / — list reservations
  app.get("/", async (request, reply) => {
    const { restaurantId, date } = request.query as {
      restaurantId?: string;
      date?: string;
    };
    const user = request.user!;
    const roleErr = requireOperationalRole(user);
    if (roleErr) {
      return reply.status(403).send({ error: roleErr });
    }

    if (restaurantId) {
      const err = enforceTenant(user, restaurantId);
      if (err) {
        return reply.status(403).send({ error: err });
      }
    }

    const scopedRestaurantId = resolveRestaurantId(user, restaurantId);
    const reservationList = await listReservations({ restaurantId: scopedRestaurantId ?? undefined, date });
    return { reservations: reservationList };
  });

  // PATCH /:id — update reservation
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateReservationSchema.parse(request.body) as Parameters<typeof updateReservation>[1];
    const [reservationRow] = await db
      .select({ restaurantId: reservations.restaurantId })
      .from(reservations)
      .where(eq(reservations.id, id))
      .limit(1);

    if (!reservationRow) {
      reply.code(404);
      return { error: "Reservation not found" };
    }

    const err = requireOperationalRole(request.user!) ?? enforceTenant(request.user!, reservationRow.restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const updated = await updateReservation(id, body);
      if (!updated) {
        reply.code(404);
        return { error: "Reservation not found" };
      }
      return { reservation: updated };
    } catch (e) {
      if (isReservationHttpError(e)) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      throw e;
    }
  });

  // POST /:id/no-show — mark reservation as no-show
  app.post("/:id/no-show", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [reservationRow] = await db
      .select({ restaurantId: reservations.restaurantId })
      .from(reservations)
      .where(eq(reservations.id, id))
      .limit(1);

    if (!reservationRow) {
      reply.code(404);
      return { error: "Reservation not found" };
    }

    const err = requireOperationalRole(request.user!) ?? enforceTenant(request.user!, reservationRow.restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const reservation = await markNoShow(id);
      if (!reservation) {
        reply.code(404);
        return { error: "Reservation not found" };
      }
      return { reservation };
    } catch (e) {
      if (isReservationHttpError(e)) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      throw e;
    }
  });

  // DELETE /:id — cancel reservation
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = (request.query ?? {}) as { reason?: string };
    const [reservationRow] = await db
      .select({ restaurantId: reservations.restaurantId })
      .from(reservations)
      .where(eq(reservations.id, id))
      .limit(1);

    if (!reservationRow) {
      reply.code(404);
      return { error: "Reservation not found" };
    }

    const err = requireOperationalRole(request.user!) ?? enforceTenant(request.user!, reservationRow.restaurantId);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const result = await cancelReservation(id, reason);
      if (!result) {
        reply.code(404);
        return { error: "Reservation not found" };
      }
      return {
        reservation: result.reservation,
        waitlistMatch: result.waitlistMatch,
      };
    } catch (e) {
      if (isReservationHttpError(e)) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      throw e;
    }
  });
}
