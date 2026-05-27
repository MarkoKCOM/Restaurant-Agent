import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  generateReferralCode,
  applyReferral,
  getReferralStats,
} from "../services/referral.service.js";
import {
  createChallenge,
  checkBirthdayWeekChallenges,
  getChallengeById,
  getGuestActiveChallenges,
  getStreak,
  incrementChallengeProgress,
  listActiveChallenges,
  updateChallenge,
} from "../services/challenge.service.js";
import { getGuestById } from "../services/guest.service.js";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";

function sendGamificationError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
) {
  request.log.warn(
    {
      ...context,
      code,
      requestId: request.id,
      statusCode,
      userId: request.user?.id,
      restaurantId: request.user?.restaurantId,
      role: request.user?.role,
    },
    "Gamification request rejected",
  );

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

function sendCaughtGamificationError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Gamification operation failed";
  request.log.warn(
    {
      ...context,
      err: error,
      code,
      requestId: request.id,
      userId: request.user?.id,
      restaurantId: request.user?.restaurantId,
      role: request.user?.role,
    },
    "Gamification operation failed",
  );

  return reply.status(400).send({
    error: message,
    code,
    requestId: request.id,
  });
}

export async function gamificationRoutes(app: FastifyInstance) {
  // ── Referrals ─────────────────────────────────────────

  // POST /:guestId/referral-code — generate referral code
  app.post("/:guestId/referral-code", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        guestId,
        restaurantId: guest.restaurantId,
      });
    }

    try {
      const code = await generateReferralCode(guestId);
      return { referralCode: code };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "REFERRAL_CODE_FAILED", { guestId });
    }
  });

  // POST /apply-referral — apply a referral code
  const applyReferralSchema = z.object({
    guestId: z.string().uuid(),
    referralCode: z.string().min(1),
  });

  app.post("/apply-referral", async (request, reply) => {
    const { guestId, referralCode } = applyReferralSchema.parse(request.body);

    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        guestId,
        restaurantId: guest.restaurantId,
      });
    }

    try {
      const result = await applyReferral(guestId, referralCode);
      return {
        success: true,
        referrerId: result.referrerId,
        referrerName: result.referrerName,
        pointsAwarded: { referrer: 50, newGuest: 25 },
      };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "APPLY_REFERRAL_FAILED", {
        guestId,
        referralCode,
      });
    }
  });

  // GET /:guestId/referral-stats — referral stats
  app.get("/:guestId/referral-stats", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        guestId,
        restaurantId: guest.restaurantId,
      });
    }

    try {
      const stats = await getReferralStats(guestId);
      return stats;
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "REFERRAL_STATS_FAILED", { guestId });
    }
  });

  // ── Challenges ────────────────────────────────────────

  // GET /challenges?restaurantId=X — list active challenges
  app.get("/challenges", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      return sendGamificationError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", { restaurantId });
    }

    const activeChallenges = await listActiveChallenges(restaurantId);
    return { challenges: activeChallenges };
  });

  // POST /challenges — create a challenge
  const createChallengeSchema = z.object({
    restaurantId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.string().min(1),
    target: z.coerce.number().int().min(1),
    reward: z.coerce.number().int().min(0),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  app.post("/challenges", async (request, reply) => {
    const parsed = createChallengeSchema.parse(request.body);

    const err = enforceTenant(request.user!, parsed.restaurantId!) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        restaurantId: parsed.restaurantId,
      });
    }

    try {
      const challenge = await createChallenge({
        restaurantId: parsed.restaurantId!,
        name: parsed.name!,
        description: parsed.description,
        type: parsed.type!,
        target: parsed.target!,
        reward: parsed.reward!,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        metadata: parsed.metadata,
      });
      reply.code(201);
      return { challenge };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "CREATE_CHALLENGE_FAILED", {
        restaurantId: parsed.restaurantId,
        challengeType: parsed.type,
      });
    }
  });

  // PATCH /challenges/:challengeId — update/deactivate a challenge
  const updateChallengeSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    type: z.string().min(1).optional(),
    target: z.coerce.number().int().min(1).optional(),
    reward: z.coerce.number().int().min(0).optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/challenges/:challengeId", async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };
    const parsed = updateChallengeSchema.parse(request.body ?? {});

    const challenge = await getChallengeById(challengeId);
    if (!challenge) {
      return sendGamificationError(
        request,
        reply,
        404,
        "Challenge not found",
        "CHALLENGE_NOT_FOUND",
        { challengeId },
      );
    }

    const err = enforceTenant(request.user!, challenge.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        challengeId,
        restaurantId: challenge.restaurantId,
      });
    }

    try {
      const updated = await updateChallenge(challengeId, challenge.restaurantId, parsed);
      return { challenge: updated };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "UPDATE_CHALLENGE_FAILED", {
        challengeId,
        restaurantId: challenge.restaurantId,
      });
    }
  });

  // POST /birthday-week/check — create private birthday-week challenges for due guests
  app.post("/birthday-week/check", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      return sendGamificationError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", { restaurantId });
    }

    try {
      const result = await checkBirthdayWeekChallenges(restaurantId);
      return { result };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "BIRTHDAY_WEEK_CHECK_FAILED", { restaurantId });
    }
  });

  // GET /:guestId/challenges — guest's challenges with progress
  app.get("/:guestId/challenges", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      return sendGamificationError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
        { guestId },
      );
    }

    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", { guestId, restaurantId });
    }
    if (guest.restaurantId !== restaurantId) {
      return sendGamificationError(
        request,
        reply,
        404,
        "Guest not found in restaurant",
        "GUEST_RESTAURANT_MISMATCH",
        { guestId, restaurantId, guestRestaurantId: guest.restaurantId },
      );
    }

    try {
      const challengesWithProgress = await getGuestActiveChallenges(guestId, restaurantId);
      return { challenges: challengesWithProgress };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "GUEST_CHALLENGES_FAILED", { guestId, restaurantId });
    }
  });

  // POST /:guestId/challenges/:challengeId/increment — increment progress
  app.post("/:guestId/challenges/:challengeId/increment", async (request, reply) => {
    const { guestId, challengeId } = request.params as {
      guestId: string;
      challengeId: string;
    };

    const guest = await getGuestById(guestId);
    const challenge = await getChallengeById(challengeId);
    if (!guest || !challenge) {
      return sendGamificationError(
        request,
        reply,
        404,
        "Guest or challenge not found",
        "GUEST_OR_CHALLENGE_NOT_FOUND",
        { guestId, challengeId },
      );
    }

    const err = enforceTenant(request.user!, challenge.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        guestId,
        challengeId,
        restaurantId: challenge.restaurantId,
      });
    }
    if (guest.restaurantId !== challenge.restaurantId) {
      return sendGamificationError(
        request,
        reply,
        404,
        "Guest not found for challenge restaurant",
        "GUEST_CHALLENGE_RESTAURANT_MISMATCH",
        { guestId, challengeId, guestRestaurantId: guest.restaurantId, challengeRestaurantId: challenge.restaurantId },
      );
    }

    try {
      const result = await incrementChallengeProgress(guestId, challengeId);
      return result;
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "INCREMENT_CHALLENGE_FAILED", {
        guestId,
        challengeId,
      });
    }
  });

  // ── Streak ────────────────────────────────────────────

  // GET /:guestId/streak — streak info
  app.get("/:guestId/streak", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendGamificationError(request, reply, 403, err, "GAMIFICATION_FORBIDDEN", {
        guestId,
        restaurantId: guest.restaurantId,
      });
    }

    try {
      const streak = await getStreak(guestId);
      return streak;
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "STREAK_LOOKUP_FAILED", { guestId });
    }
  });
}
