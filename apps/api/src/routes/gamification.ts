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
import {
  finalizeMonthlyLeaderboard,
  getLeaderboard,
  getGuestLeaderboardRank,
  setLeaderboardOptIn,
} from "../services/leaderboard.service.js";
import { getGuestShareTemplates } from "../services/gamification-share.service.js";
import { getGuestById } from "../services/guest.service.js";
import { enforceTenant, requireGrowthPackage, requireRestaurantAdmin } from "../middleware/auth.js";

function sendGamificationError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
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
    ...extra,
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

async function enforceGamificationAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  restaurantId: string,
  context: Record<string, unknown> = {},
) {
  const accessError = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
  if (accessError) {
    return sendGamificationError(request, reply, 403, accessError, "GAMIFICATION_FORBIDDEN", {
      ...context,
      restaurantId,
    });
  }

  const packageAccess = await requireGrowthPackage(restaurantId);
  if (!packageAccess.ok) {
    return sendGamificationError(
      request,
      reply,
      packageAccess.code === "RESTAURANT_NOT_FOUND" ? 404 : 403,
      packageAccess.error ?? "Growth package required",
      packageAccess.code ?? "PACKAGE_GROWTH_REQUIRED",
      { ...context, restaurantId, restaurantPackage: packageAccess.restaurantPackage, requiredPackage: "growth" },
      { restaurantId, restaurantPackage: packageAccess.restaurantPackage, requiredPackage: "growth" },
    );
  }

  return null;
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

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

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

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

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

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

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

    const accessError = await enforceGamificationAccess(request, reply, restaurantId);
    if (accessError) return accessError;

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

    const accessError = await enforceGamificationAccess(request, reply, parsed.restaurantId!);
    if (accessError) return accessError;

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

    const accessError = await enforceGamificationAccess(request, reply, challenge.restaurantId, { challengeId });
    if (accessError) return accessError;

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
    const { restaurantId, guestId } = request.query as { restaurantId?: string; guestId?: string };

    if (!restaurantId) {
      return sendGamificationError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const accessError = await enforceGamificationAccess(request, reply, restaurantId);
    if (accessError) return accessError;

    try {
      const result = await checkBirthdayWeekChallenges(restaurantId, { guestId });
      return { result };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "BIRTHDAY_WEEK_CHECK_FAILED", { restaurantId, guestId });
    }
  });

  // ── Social sharing ───────────────────────────────────

  const shareTemplateQuerySchema = z.object({
    moment: z.enum([
      "achievement",
      "tier_promotion",
      "challenge_completion",
      "streak_milestone",
      "leaderboard_rank",
      "birthday_week",
    ]).optional(),
    achievementKey: z.string().min(1).optional(),
    challengeName: z.string().min(1).optional(),
  });

  app.get("/:guestId/share-templates", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const query = shareTemplateQuerySchema.parse(request.query ?? {});
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

    try {
      const shareTemplates = await getGuestShareTemplates(guestId, query);
      if (!shareTemplates) {
        return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
      }
      return { shareTemplates };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "SHARE_TEMPLATES_FAILED", { guestId });
    }
  });

  // ── Leaderboard ──────────────────────────────────────

  const leaderboardQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });

  app.get("/leaderboard", async (request, reply) => {
    const query = leaderboardQuerySchema.parse(request.query);
    const accessError = await enforceGamificationAccess(request, reply, query.restaurantId);
    if (accessError) return accessError;

    try {
      const leaderboard = await getLeaderboard(query.restaurantId, query.period, query.limit ?? 10);
      return { leaderboard };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "LEADERBOARD_LOOKUP_FAILED", {
        restaurantId: query.restaurantId,
        period: query.period,
      });
    }
  });

  const finalizeLeaderboardSchema = z.object({
    restaurantId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    rewards: z.array(z.coerce.number().int().min(0)).min(1).max(10).optional(),
  });

  app.post("/leaderboard/finalize", async (request, reply) => {
    const parsed = finalizeLeaderboardSchema.parse(request.body ?? {});
    const accessError = await enforceGamificationAccess(request, reply, parsed.restaurantId);
    if (accessError) return accessError;

    try {
      const result = await finalizeMonthlyLeaderboard(parsed);
      return { result };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "LEADERBOARD_FINALIZE_FAILED", {
        restaurantId: parsed.restaurantId,
        period: parsed.period,
      });
    }
  });

  app.post("/:guestId/leaderboard/opt-in", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

    try {
      const leaderboard = await setLeaderboardOptIn(guestId, true);
      const rank = await getGuestLeaderboardRank(guestId, guest.restaurantId);
      return { leaderboard, rank };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "LEADERBOARD_OPT_IN_FAILED", { guestId });
    }
  });

  app.post("/:guestId/leaderboard/opt-out", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      return sendGamificationError(request, reply, 404, "Guest not found", "GUEST_NOT_FOUND", { guestId });
    }

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

    try {
      const leaderboard = await setLeaderboardOptIn(guestId, false);
      return { leaderboard };
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "LEADERBOARD_OPT_OUT_FAILED", { guestId });
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

    const accessError = await enforceGamificationAccess(request, reply, restaurantId, { guestId });
    if (accessError) return accessError;
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

    const accessError = await enforceGamificationAccess(request, reply, challenge.restaurantId, { guestId, challengeId });
    if (accessError) return accessError;
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

    const accessError = await enforceGamificationAccess(request, reply, guest.restaurantId, { guestId });
    if (accessError) return accessError;

    try {
      const streak = await getStreak(guestId);
      return streak;
    } catch (err: unknown) {
      return sendCaughtGamificationError(request, reply, err, "STREAK_LOOKUP_FAILED", { guestId });
    }
  });
}
