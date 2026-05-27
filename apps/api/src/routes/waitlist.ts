import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

function sendWaitlistError(
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
    request.log.error(logPayload, "Waitlist request failed");
  } else {
    request.log.warn(logPayload, "Waitlist request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

function sendCaughtWaitlistError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Waitlist operation failed";
  return sendWaitlistError(request, reply, 500, message, code, {
    ...context,
    err: error,
  });
}

async function lookupWaitlistRestaurantId(
  request: FastifyRequest,
  reply: FastifyReply,
  waitlistId: string,
  failureCode: string,
): Promise<string | null | FastifyReply> {
  try {
    const [waitlistRow] = await db
      .select({ restaurantId: waitlist.restaurantId })
      .from(waitlist)
      .where(eq(waitlist.id, waitlistId))
      .limit(1);
    return waitlistRow?.restaurantId ?? null;
  } catch (error: unknown) {
    return sendCaughtWaitlistError(request, reply, error, failureCode, { waitlistId });
  }
}

export async function waitlistRoutes(app: FastifyInstance) {
  // POST / — add to waitlist
  app.post("/", async (request, reply) => {
    const parsed = addToWaitlistSchema.parse(request.body);
    const user = request.user;

    if (user) {
      const err = enforceTenant(user, parsed.restaurantId!);
      if (err) {
        return sendWaitlistError(
          request,
          reply,
          403,
          err,
          "WAITLIST_FORBIDDEN",
          { restaurantLookupId: parsed.restaurantId },
        );
      }
    }

    try {
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
    } catch (error: unknown) {
      return sendCaughtWaitlistError(request, reply, error, "WAITLIST_ADD_FAILED", {
        restaurantLookupId: parsed.restaurantId,
        date: parsed.date,
        preferredTimeStart: parsed.preferredTimeStart,
        preferredTimeEnd: parsed.preferredTimeEnd,
        partySize: parsed.partySize,
      });
    }
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
        return sendWaitlistError(
          request,
          reply,
          403,
          err,
          "WAITLIST_FORBIDDEN",
          { restaurantLookupId: restaurantId },
        );
      }
    }

    const scopedRestaurantId = resolveRestaurantId(request.user!, restaurantId);
    if (!scopedRestaurantId) {
      return { waitlist: [] };
    }

    try {
      await expireStaleOffers();
      const entries = await listWaitlist(scopedRestaurantId, date);
      return { waitlist: entries };
    } catch (error: unknown) {
      return sendCaughtWaitlistError(request, reply, error, "WAITLIST_LIST_FAILED", {
        restaurantLookupId: restaurantId,
        scopedRestaurantId,
        date,
      });
    }
  });

  // POST /:id/offer — offer a slot to a waitlist entry
  app.post("/:id/offer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const restaurantId = await lookupWaitlistRestaurantId(
      request,
      reply,
      id,
      "WAITLIST_LOOKUP_FAILED",
    );
    if (typeof restaurantId !== "string" && restaurantId !== null) return restaurantId;

    if (!restaurantId) {
      return sendWaitlistError(
        request,
        reply,
        404,
        "Waitlist entry not found",
        "WAITLIST_ENTRY_NOT_FOUND",
        { waitlistId: id },
      );
    }

    const err = enforceTenant(request.user!, restaurantId);
    if (err) {
      return sendWaitlistError(
        request,
        reply,
        403,
        err,
        "WAITLIST_FORBIDDEN",
        { waitlistId: id, restaurantLookupId: restaurantId },
      );
    }

    try {
      const entry = await offerSlot(id);
      if (!entry) {
        return sendWaitlistError(
          request,
          reply,
          404,
          "Waitlist entry not found",
          "WAITLIST_ENTRY_NOT_FOUND",
          { waitlistId: id, restaurantLookupId: restaurantId },
        );
      }
      return { waitlistEntry: entry };
    } catch (error: unknown) {
      return sendCaughtWaitlistError(request, reply, error, "WAITLIST_OFFER_FAILED", {
        waitlistId: id,
        restaurantLookupId: restaurantId,
      });
    }
  });

  // POST /:id/accept — accept offer and create reservation
  app.post("/:id/accept", async (request, reply) => {
    const { id } = request.params as { id: string };
    const restaurantId = await lookupWaitlistRestaurantId(
      request,
      reply,
      id,
      "WAITLIST_LOOKUP_FAILED",
    );
    if (typeof restaurantId !== "string" && restaurantId !== null) return restaurantId;

    if (!restaurantId) {
      return sendWaitlistError(
        request,
        reply,
        404,
        "Waitlist entry not found or not in offered state",
        "WAITLIST_OFFER_NOT_FOUND",
        { waitlistId: id },
      );
    }

    const user = request.user;
    if (user) {
      const err = enforceTenant(user, restaurantId);
      if (err) {
        return sendWaitlistError(
          request,
          reply,
          403,
          err,
          "WAITLIST_FORBIDDEN",
          { waitlistId: id, restaurantLookupId: restaurantId },
        );
      }
    }

    try {
      const result = await acceptOffer(id);
      if (!result) {
        return sendWaitlistError(
          request,
          reply,
          404,
          "Waitlist entry not found or not in offered state",
          "WAITLIST_OFFER_NOT_FOUND",
          { waitlistId: id, restaurantLookupId: restaurantId },
        );
      }
      return {
        waitlistEntry: result.waitlistEntry,
        reservationId: result.reservationId,
      };
    } catch (error: unknown) {
      return sendCaughtWaitlistError(request, reply, error, "WAITLIST_ACCEPT_FAILED", {
        waitlistId: id,
        restaurantLookupId: restaurantId,
      });
    }
  });

  // DELETE /:id — cancel waitlist entry
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const restaurantId = await lookupWaitlistRestaurantId(
      request,
      reply,
      id,
      "WAITLIST_LOOKUP_FAILED",
    );
    if (typeof restaurantId !== "string" && restaurantId !== null) return restaurantId;

    if (!restaurantId) {
      return sendWaitlistError(
        request,
        reply,
        404,
        "Waitlist entry not found",
        "WAITLIST_ENTRY_NOT_FOUND",
        { waitlistId: id },
      );
    }

    const err = enforceTenant(request.user!, restaurantId);
    if (err) {
      return sendWaitlistError(
        request,
        reply,
        403,
        err,
        "WAITLIST_FORBIDDEN",
        { waitlistId: id, restaurantLookupId: restaurantId },
      );
    }

    try {
      const entry = await cancelWaitlistEntry(id);
      if (!entry) {
        return sendWaitlistError(
          request,
          reply,
          404,
          "Waitlist entry not found",
          "WAITLIST_ENTRY_NOT_FOUND",
          { waitlistId: id, restaurantLookupId: restaurantId },
        );
      }
      return { waitlistEntry: entry };
    } catch (error: unknown) {
      return sendCaughtWaitlistError(request, reply, error, "WAITLIST_CANCEL_FAILED", {
        waitlistId: id,
        restaurantLookupId: restaurantId,
      });
    }
  });
}
