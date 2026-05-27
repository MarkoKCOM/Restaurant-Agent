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
  refreshVisitAutoTags,
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
    const rows = await listGuests({ restaurantId: scopedRestaurantId ?? undefined });
    const guests = rows.map(toDomainGuest);
    return { guests };
  });

  // GET /:id — guest profile (with optional reservation history)
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { includeHistory } = request.query as { includeHistory?: string };
    const row = await getGuestById(id);

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
  });

  // GET /:id/full-profile — mega profile for WhatsApp bot
  app.get("/:id/full-profile", async (request, reply) => {
    const { id } = request.params as { id: string };
    const guestRow = await getGuestById(id);
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

    const profile = await getFullGuestProfile(id);
    if (!profile) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    return { profile };
  });

  // GET /:id/sentiment — sentiment history
  app.get("/:id/sentiment", async (request, reply) => {
    const { id } = request.params as { id: string };
    const guestRow = await getGuestById(id);
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

    const history = await getGuestSentimentHistory(id);
    return { history };
  });

  // POST /:id/auto-tag — recalculate and apply auto tags
  app.post("/:id/auto-tag", async (request, reply) => {
    const { id } = request.params as { id: string };
    const guestRow = await getGuestById(id);
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

    const tags = await autoTagGuest(id);
    if (!tags) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    return { tags };
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
    });

    const prefs = preferencesSchema.parse(request.body ?? {});
    const guestRow = await getGuestById(id);
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

    const updated = await updateGuestPreferences(id, { preferences: prefs });
    if (!updated) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    return { guest: toDomainGuest(updated) };
  });

  // PATCH /:id — update guest preferences
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGuestSchema.parse(request.body ?? {}) as Parameters<typeof updateGuestPreferences>[1];
    const guestRow = await getGuestById(id);
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

    const updated = await updateGuestPreferences(id, body);
    if (!updated) {
      return sendGuestError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId: id });
    }

    return { guest: toDomainGuest(updated) };
  });
}
