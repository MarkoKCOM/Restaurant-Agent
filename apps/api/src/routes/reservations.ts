import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

function reservationErrorCode(message: string, fallback = "RESERVATION_OPERATION_FAILED"): string {
  if (message.includes("Restaurant not found")) return "RESERVATION_RESTAURANT_NOT_FOUND";
  if (message.includes("closed")) return "RESERVATION_RESTAURANT_CLOSED";
  if (message.includes("date in the past")) return "RESERVATION_DATE_IN_PAST";
  if (message.includes("outside operating hours")) return "RESERVATION_OUTSIDE_OPERATING_HOURS";
  if (message.includes("No tables available")) return "RESERVATION_NO_TABLES_AVAILABLE";
  if (message.includes("No suitable table combination")) return "RESERVATION_NO_TABLE_COMBINATION";
  if (message.includes("Cannot transition reservation")) return "RESERVATION_INVALID_STATUS_TRANSITION";
  return fallback;
}

function sendReservationError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
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
    request.log.error(logPayload, "Reservation request failed");
  } else {
    request.log.warn(logPayload, "Reservation request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
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
    const parsed = createReservationSchema.parse(request.body);
    try {
      const reservation = await createReservation({
        restaurantId: parsed.restaurantId!,
        guestName: parsed.guestName!,
        guestPhone: parsed.guestPhone!,
        date: parsed.date!,
        timeStart: parsed.timeStart!,
        partySize: parsed.partySize!,
        source: parsed.source,
        notes: parsed.notes,
      });
      reply.code(201);
      return { reservation };
    } catch (err) {
      if (isReservationHttpError(err)) {
        return sendReservationError(
          request,
          reply,
          err.statusCode,
          err.message,
          reservationErrorCode(err.message, "RESERVATION_CREATE_FAILED"),
          {
            restaurantLookupId: parsed.restaurantId,
            date: parsed.date,
            timeStart: parsed.timeStart,
            partySize: parsed.partySize,
            source: parsed.source,
          },
        );
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
      return sendReservationError(
        request,
        reply,
        403,
        err,
        "RESERVATION_FORBIDDEN",
        { restaurantLookupId: body.restaurantId },
      );
    }

    try {
      const reservation = await createWalkIn(body);
      reply.code(201);
      return { reservation };
    } catch (error) {
      if (isReservationHttpError(error)) {
        return sendReservationError(
          request,
          reply,
          error.statusCode,
          error.message,
          reservationErrorCode(error.message, "RESERVATION_WALK_IN_CREATE_FAILED"),
          {
            restaurantLookupId: body.restaurantId,
            partySize: body.partySize,
            seatImmediately: body.seatImmediately,
          },
        );
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
      return sendReservationError(request, reply, 403, roleErr, "RESERVATION_FORBIDDEN");
    }

    if (restaurantId) {
      const err = enforceTenant(user, restaurantId);
      if (err) {
        return sendReservationError(
          request,
          reply,
          403,
          err,
          "RESERVATION_FORBIDDEN",
          { restaurantLookupId: restaurantId },
        );
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
      return sendReservationError(
        request,
        reply,
        404,
        "Reservation not found",
        "RESERVATION_NOT_FOUND",
        { reservationId: id },
      );
    }

    const err = requireOperationalRole(request.user!) ?? enforceTenant(request.user!, reservationRow.restaurantId);
    if (err) {
      return sendReservationError(
        request,
        reply,
        403,
        err,
        "RESERVATION_FORBIDDEN",
        { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
      );
    }

    try {
      const updated = await updateReservation(id, body, { logger: request.log });
      if (!updated) {
        return sendReservationError(
          request,
          reply,
          404,
          "Reservation not found",
          "RESERVATION_NOT_FOUND",
          { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
        );
      }
      return { reservation: updated };
    } catch (e) {
      if (isReservationHttpError(e)) {
        return sendReservationError(
          request,
          reply,
          e.statusCode,
          e.message,
          reservationErrorCode(e.message, "RESERVATION_UPDATE_FAILED"),
          { reservationId: id, restaurantLookupId: reservationRow.restaurantId, status: body.status },
        );
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
      return sendReservationError(
        request,
        reply,
        404,
        "Reservation not found",
        "RESERVATION_NOT_FOUND",
        { reservationId: id },
      );
    }

    const err = requireOperationalRole(request.user!) ?? enforceTenant(request.user!, reservationRow.restaurantId);
    if (err) {
      return sendReservationError(
        request,
        reply,
        403,
        err,
        "RESERVATION_FORBIDDEN",
        { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
      );
    }

    try {
      const reservation = await markNoShow(id);
      if (!reservation) {
        return sendReservationError(
          request,
          reply,
          404,
          "Reservation not found",
          "RESERVATION_NOT_FOUND",
          { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
        );
      }
      return { reservation };
    } catch (e) {
      if (isReservationHttpError(e)) {
        return sendReservationError(
          request,
          reply,
          e.statusCode,
          e.message,
          reservationErrorCode(e.message, "RESERVATION_NO_SHOW_FAILED"),
          { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
        );
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
      return sendReservationError(
        request,
        reply,
        404,
        "Reservation not found",
        "RESERVATION_NOT_FOUND",
        { reservationId: id },
      );
    }

    const err = requireOperationalRole(request.user!) ?? enforceTenant(request.user!, reservationRow.restaurantId);
    if (err) {
      return sendReservationError(
        request,
        reply,
        403,
        err,
        "RESERVATION_FORBIDDEN",
        { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
      );
    }

    try {
      const result = await cancelReservation(id, reason);
      if (!result) {
        return sendReservationError(
          request,
          reply,
          404,
          "Reservation not found",
          "RESERVATION_NOT_FOUND",
          { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
        );
      }
      return {
        reservation: result.reservation,
        waitlistMatch: result.waitlistMatch,
      };
    } catch (e) {
      if (isReservationHttpError(e)) {
        return sendReservationError(
          request,
          reply,
          e.statusCode,
          e.message,
          reservationErrorCode(e.message, "RESERVATION_CANCEL_FAILED"),
          { reservationId: id, restaurantLookupId: reservationRow.restaurantId },
        );
      }
      throw e;
    }
  });
}
