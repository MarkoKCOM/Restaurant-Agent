import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  awardPoints,
  checkStampCard,
  createReward,
  getPointsBalance,
  getTransactionHistory,
  listRewards,
  redeemReward,
} from "../services/loyalty.service.js";
import { getGuestById } from "../services/guest.service.js";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";

const awardPointsSchema = z.object({
  restaurantId: z.string().uuid(),
  points: z.coerce.number().int().min(1),
  reason: z.string().min(1),
});

const createRewardSchema = z.object({
  restaurantId: z.string().uuid(),
  nameHe: z.string().min(1),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  pointsCost: z.coerce.number().int().min(1),
});

const redeemRewardSchema = z.object({
  restaurantId: z.string().uuid(),
});

export async function loyaltyRoutes(app: FastifyInstance) {
  // GET /:guestId/balance — points balance + tier + stamp progress
  app.get("/:guestId/balance", async (request, reply) => {
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

    const balance = await getPointsBalance(guestId);
    if (!balance) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const stampCard = await checkStampCard(guestId);

    return {
      guestId,
      pointsBalance: balance.pointsBalance,
      tier: balance.tier,
      stampCard,
    };
  });

  // GET /:guestId/history — transaction history
  app.get("/:guestId/history", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const { limit } = request.query as { limit?: string };
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
    const transactions = await getTransactionHistory(guestId, parsedLimit);

    return { transactions };
  });

  // POST /:guestId/award — manual point award (owner action)
  app.post("/:guestId/award", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const body = awardPointsSchema.parse(request.body);
    const err = enforceTenant(request.user!, body.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const transaction = await awardPoints(
      guestId,
      body.restaurantId,
      body.points,
      body.reason,
    );

    reply.code(201);
    return { transaction };
  });

  // GET /rewards — list rewards for a restaurant
  app.get("/rewards", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      reply.code(400);
      return { error: "restaurantId query parameter is required" };
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const rewardsList = await listRewards(restaurantId);
    return { rewards: rewardsList };
  });

  // POST /rewards — create a reward
  app.post("/rewards", async (request, reply) => {
    const body = createRewardSchema.parse(request.body) as {
      restaurantId: string;
      nameHe: string;
      nameEn?: string;
      description?: string;
      pointsCost: number;
    };
    const err = enforceTenant(request.user!, body.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const reward = await createReward(body);
    reply.code(201);
    return { reward };
  });

  // POST /:guestId/redeem/:rewardId — redeem a reward
  app.post("/:guestId/redeem/:rewardId", async (request, reply) => {
    const { guestId, rewardId } = request.params as {
      guestId: string;
      rewardId: string;
    };
    const body = redeemRewardSchema.parse(request.body);
    const err = enforceTenant(request.user!, body.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const result = await redeemReward(guestId, body.restaurantId, rewardId);
      return { redemption: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Redemption failed";
      if (message.includes("Insufficient points")) {
        reply.code(400);
        return { error: message };
      }
      if (message.includes("not found") || message.includes("not belong")) {
        reply.code(404);
        return { error: message };
      }
      throw err;
    }
  });

  // GET /:guestId/stamp-card — stamp card status
  app.get("/:guestId/stamp-card", async (request, reply) => {
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

    const stampCard = await checkStampCard(guestId);
    if (!stampCard) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    return { stampCard };
  });
}
