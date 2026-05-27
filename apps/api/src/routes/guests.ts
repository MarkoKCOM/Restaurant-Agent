import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
import { enforceTenant, requireRestaurantAdmin, resolveRestaurantId } from "../middleware/auth.js";

const updateGuestSchema = z.object({
  preferences: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  optedOutCampaigns: z.boolean().optional(),
});

function sendGuestError(
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
    request.log.error(logPayload, "Guest request failed");
  } else {
    request.log.warn(logPayload, "Guest request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

function sendCaughtGuestError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Guest operation failed";
  return sendGuestError(request, reply, 500, message, code, {
    ...context,
    err: error,
  });
}

export async function guestRoutes(app: FastifyInstance) {
  // GET / — list guests
  app.get("/", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };
    const user = request.user!;
    const roleErr = requireRestaurantAdmin(user);
    if (roleErr) {
      return sendGuestError(request, reply, 403, roleErr, "GUEST_FORBIDDEN");
    }

    if (restaurantId) {
      const err = enforceTenant(user, restaurantId);
      if (err) {
        return sendGuestError(
          request,
          reply,
          403,
          err,
          "GUEST_FORBIDDEN",
          { restaurantLookupId: restaurantId },
        );
      }
    }

    const scopedRestaurantId = resolveRestaurantId(user, restaurantId);
    try {
      const rows = await listGuests({ restaurantId: scopedRestaurantId ?? undefined });
      const guests = rows.map(toDomainGuest);
      return { guests };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LIST_FAILED", {
        restaurantLookupId: restaurantId,
        scopedRestaurantId,
      });
    }
  });

  // GET /:id — guest profile (with optional reservation history)
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { includeHistory } = request.query as { includeHistory?: string };
    let row: Awaited<ReturnType<typeof getGuestById>>;
    try {
      row = await getGuestById(id);
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LOOKUP_FAILED", { guestId: id });
    }

    if (!row) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    const err = enforceTenant(request.user!, row.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { guestId: id, restaurantLookupId: row.restaurantId },
      );
    }

    const guest = toDomainGuest(row);

    if (includeHistory === "true") {
      let guestReservations;
      try {
        guestReservations = await db
          .select()
          .from(reservations)
          .where(eq(reservations.guestId, id))
          .orderBy(desc(reservations.date), desc(reservations.timeStart))
          .limit(20);
      } catch (error: unknown) {
        return sendCaughtGuestError(request, reply, error, "GUEST_RESERVATION_HISTORY_FAILED", {
          guestId: id,
          restaurantLookupId: row.restaurantId,
        });
      }

      return { guest, reservations: guestReservations };
    }

    return { guest };
  });

  // POST / — create or find guest
  app.post("/", async (request, reply) => {
    const parsed = createGuestSchema.parse(request.body);
    const err = enforceTenant(request.user!, parsed.restaurantId!) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { restaurantLookupId: parsed.restaurantId },
      );
    }

    try {
      const row = await findOrCreateGuest({
        restaurantId: parsed.restaurantId!,
        name: parsed.name!,
        phone: parsed.phone!,
        email: parsed.email,
        language: parsed.language,
        source: parsed.source,
      });
      reply.code(201);
      return { guest: toDomainGuest(row) };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_CREATE_FAILED", {
        restaurantLookupId: parsed.restaurantId,
        source: parsed.source,
      });
    }
  });

  // GET /:id/full-profile — mega profile for WhatsApp bot
  app.get("/:id/full-profile", async (request, reply) => {
    const { id } = request.params as { id: string };
    let guestRow: Awaited<ReturnType<typeof getGuestById>>;
    try {
      guestRow = await getGuestById(id);
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LOOKUP_FAILED", { guestId: id });
    }
    if (!guestRow) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    const err = enforceTenant(request.user!, guestRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { guestId: id, restaurantLookupId: guestRow.restaurantId },
      );
    }

    try {
      const profile = await getFullGuestProfile(id);
      if (!profile) {
        return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
      }

      return { profile };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_FULL_PROFILE_FAILED", {
        guestId: id,
        restaurantLookupId: guestRow.restaurantId,
      });
    }
  });

  // GET /:id/sentiment — sentiment history
  app.get("/:id/sentiment", async (request, reply) => {
    const { id } = request.params as { id: string };
    let guestRow: Awaited<ReturnType<typeof getGuestById>>;
    try {
      guestRow = await getGuestById(id);
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LOOKUP_FAILED", { guestId: id });
    }
    if (!guestRow) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    const err = enforceTenant(request.user!, guestRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { guestId: id, restaurantLookupId: guestRow.restaurantId },
      );
    }

    try {
      const history = await getGuestSentimentHistory(id);
      return { history };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_SENTIMENT_HISTORY_FAILED", {
        guestId: id,
        restaurantLookupId: guestRow.restaurantId,
      });
    }
  });

  // POST /:id/auto-tag — recalculate and apply auto tags
  app.post("/:id/auto-tag", async (request, reply) => {
    const { id } = request.params as { id: string };
    let guestRow: Awaited<ReturnType<typeof getGuestById>>;
    try {
      guestRow = await getGuestById(id);
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LOOKUP_FAILED", { guestId: id });
    }
    if (!guestRow) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    const err = enforceTenant(request.user!, guestRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { guestId: id, restaurantLookupId: guestRow.restaurantId },
      );
    }

    try {
      const tags = await autoTagGuest(id);
      if (!tags) {
        return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
      }

      return { tags };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_AUTO_TAG_FAILED", {
        guestId: id,
        restaurantLookupId: guestRow.restaurantId,
      });
    }
  });

  // PUT /:id/preferences — update structured guest preferences
  app.put("/:id/preferences", async (request, reply) => {
    const { id } = request.params as { id: string };

    const preferencesSchema = z.object({
      dietary: z.array(z.string()).default([]),
      seating: z.string().default("no_preference"),
      language: z.string().default("he"),
      notes: z.string().default(""),
      hospitalitySignals: z.array(z.string()).default([]),
      hospitalityNote: z.string().default(""),
      birthday: z.string().regex(/^(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})$/).optional(),
    });

    const prefs = preferencesSchema.parse(request.body ?? {});
    let guestRow: Awaited<ReturnType<typeof getGuestById>>;
    try {
      guestRow = await getGuestById(id);
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LOOKUP_FAILED", { guestId: id });
    }
    if (!guestRow) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    const err = enforceTenant(request.user!, guestRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { guestId: id, restaurantLookupId: guestRow.restaurantId },
      );
    }

    try {
      const updated = await updateGuestPreferences(id, { preferences: prefs });
      if (!updated) {
        return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
      }

      return { guest: toDomainGuest(updated) };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_PREFERENCES_UPDATE_FAILED", {
        guestId: id,
        restaurantLookupId: guestRow.restaurantId,
      });
    }
  });

  // PATCH /:id — update guest preferences
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGuestSchema.parse(request.body ?? {}) as Parameters<typeof updateGuestPreferences>[1];
    let guestRow: Awaited<ReturnType<typeof getGuestById>>;
    try {
      guestRow = await getGuestById(id);
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_LOOKUP_FAILED", { guestId: id });
    }
    if (!guestRow) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    const err = enforceTenant(request.user!, guestRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGuestError(
        request,
        reply,
        403,
        err,
        "GUEST_FORBIDDEN",
        { guestId: id, restaurantLookupId: guestRow.restaurantId },
      );
    }

    try {
      const updated = await updateGuestPreferences(id, body);
      if (!updated) {
        return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
      }

      return { guest: toDomainGuest(updated) };
    } catch (error: unknown) {
      return sendCaughtGuestError(request, reply, error, "GUEST_UPDATE_FAILED", {
        guestId: id,
        restaurantLookupId: guestRow.restaurantId,
      });
    }
  });
}
