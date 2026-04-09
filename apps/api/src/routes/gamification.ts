import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  generateReferralCode,
  applyReferral,
  getReferralStats,
} from "../services/referral.service.js";
import {
  createChallenge,
  getChallengeById,
  getGuestActiveChallenges,
  getStreak,
  incrementChallengeProgress,
  listActiveChallenges,
} from "../services/challenge.service.js";
import { getGuestById } from "../services/guest.service.js";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";

export async function gamificationRoutes(app: FastifyInstance) {
  // ── Referrals ─────────────────────────────────────────

  // POST /:guestId/referral-code — generate referral code
  app.post("/:guestId/referral-code", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const code = await generateReferralCode(guestId);
      return { referralCode: code };
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
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
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const result = await applyReferral(guestId, referralCode);
      return {
        success: true,
        referrerId: result.referrerId,
        referrerName: result.referrerName,
        pointsAwarded: { referrer: 50, newGuest: 25 },
      };
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  // GET /:guestId/referral-stats — referral stats
  app.get("/:guestId/referral-stats", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const stats = await getReferralStats(guestId);
      return stats;
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  // ── Challenges ────────────────────────────────────────

  // GET /challenges?restaurantId=X — list active challenges
  app.get("/challenges", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      reply.code(400);
      return { error: "restaurantId query parameter is required" };
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
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
  });

  app.post("/challenges", async (request, reply) => {
    const body = createChallengeSchema.parse(request.body);

    const err = enforceTenant(request.user!, body.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const challenge = await createChallenge(body);
      reply.code(201);
      return { challenge };
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  // GET /:guestId/challenges — guest's challenges with progress
  app.get("/:guestId/challenges", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      reply.code(400);
      return { error: "restaurantId query parameter is required" };
    }

    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }
    if (guest.restaurantId !== restaurantId) {
      return reply.status(404).send({ error: "Guest not found in restaurant" });
    }

    try {
      const challengesWithProgress = await getGuestActiveChallenges(guestId, restaurantId);
      return { challenges: challengesWithProgress };
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
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
      reply.code(404);
      return { error: "Guest or challenge not found" };
    }

    const err = enforceTenant(request.user!, challenge.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }
    if (guest.restaurantId !== challenge.restaurantId) {
      return reply.status(404).send({ error: "Guest not found for challenge restaurant" });
    }

    try {
      const result = await incrementChallengeProgress(guestId, challengeId);
      return result;
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  // ── Streak ────────────────────────────────────────────

  // GET /:guestId/streak — streak info
  app.get("/:guestId/streak", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const streak = await getStreak(guestId);
      return streak;
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });
}
