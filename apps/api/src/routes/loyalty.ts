import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  awardPoints,
  checkStampCard,
  createReward,
  getPointsBalance,
  getTransactionHistory,
  listRewards,
  updateReward,
} from "../services/loyalty.service.js";
import { getMembershipSummary } from "../services/membership-summary.service.js";
import {
  claimReward,
  getClaimById,
  redeemClaim,
  verifyClaimByCode,
} from "../services/reward-claims.service.js";
import { getGuestById, toDomainGuest, updateGuestPreferences } from "../services/guest.service.js";
import {
  enforceTenant,
  requireOperationalRole,
  requireRestaurantAdmin,
} from "../middleware/auth.js";

const awardPointsSchema = z.object({
  restaurantId: z.string().uuid().optional(),
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

const updateRewardSchema = z.object({
  nameHe: z.string().min(1).optional(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  pointsCost: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

const claimRewardSchema = z.object({
  reservationId: z.string().uuid().optional(),
});

const messagingPreferencesSchema = z.object({
  optedOutCampaigns: z.boolean(),
});

function sendLoyaltyError(reply: { code: (status: number) => unknown }, err: unknown) {
  const message = err instanceof Error ? err.message : "Loyalty operation failed";
  if (message.includes("Insufficient points")) {
    reply.code(400);
    return { error: message };
  }
  if (
    message.includes("not found")
    || message.includes("not belong")
    || message.includes("does not belong")
  ) {
    reply.code(404);
    return { error: message };
  }
  if (message.includes("already")) {
    reply.code(409);
    return { error: message };
  }
  reply.code(400);
  return { error: message };
}

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

    return {
      transactions: transactions.map((tx) => ({
        ...tx,
        description: tx.reason ?? tx.type,
      })),
    };
  });

  // GET /:guestId/summary — normalized WhatsApp/member summary
  app.get("/:guestId/summary", async (request, reply) => {
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

    const summary = await getMembershipSummary(guestId);
    if (!summary) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    return { summary };
  });

  // POST /:guestId/award — manual point award (owner action)
  app.post("/:guestId/award", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const body = awardPointsSchema.parse(request.body);
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const transaction = await awardPoints(
      guestId,
      guest.restaurantId,
      body.points,
      body.reason,
    );

    reply.code(201);
    return { transaction };
  });

  // GET /rewards — list rewards for a restaurant
  app.get("/rewards", async (request, reply) => {
    const { restaurantId, includeInactive } = request.query as {
      restaurantId?: string;
      includeInactive?: string;
    };

    if (!restaurantId) {
      reply.code(400);
      return { error: "restaurantId query parameter is required" };
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const rewardsList = await listRewards(restaurantId, includeInactive === "true");
    return { rewards: rewardsList };
  });

  // PATCH /rewards/:rewardId — update reward fields (admin/super_admin)
  app.patch("/rewards/:rewardId", async (request, reply) => {
    const { rewardId } = request.params as { rewardId: string };
    const body = updateRewardSchema.parse(request.body ?? {});

    const adminErr = requireRestaurantAdmin(request.user!);
    if (adminErr) return reply.status(403).send({ error: adminErr });

    const restaurantId = request.user!.restaurantId;
    if (!restaurantId) {
      reply.code(400);
      return { error: "Restaurant context required" };
    }

    const updated = await updateReward(rewardId, restaurantId, body);
    if (!updated) {
      reply.code(404);
      return { error: "Reward not found" };
    }

    return { reward: updated };
  });

  // POST /rewards — create a reward
  app.post("/rewards", async (request, reply) => {
    const parsed = createRewardSchema.parse(request.body);
    const err = enforceTenant(request.user!, parsed.restaurantId!) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const reward = await createReward({
      restaurantId: parsed.restaurantId!,
      nameHe: parsed.nameHe!,
      nameEn: parsed.nameEn,
      description: parsed.description,
      pointsCost: parsed.pointsCost!,
    });
    reply.code(201);
    return { reward };
  });

  // POST /:guestId/rewards/:rewardId/claim — claim a reward for later redemption
  app.post("/:guestId/rewards/:rewardId/claim", async (request, reply) => {
    const { guestId, rewardId } = request.params as { guestId: string; rewardId: string };
    const body = claimRewardSchema.parse(request.body ?? {});
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireOperationalRole(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const claim = await claimReward(guestId, rewardId, body.reservationId);
      reply.code(201);
      return { claim };
    } catch (err) {
      return sendLoyaltyError(reply, err);
    }
  });

  // POST /:guestId/redeem/:rewardId — backwards-compatible alias for claim flow
  app.post("/:guestId/redeem/:rewardId", async (request, reply) => {
    const { guestId, rewardId } = request.params as { guestId: string; rewardId: string };
    const body = claimRewardSchema.parse(request.body ?? {});
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireOperationalRole(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const claim = await claimReward(guestId, rewardId, body.reservationId);
      return {
        redemption: {
          transactionId: claim.loyaltyTransactionId,
          rewardName: claim.rewardName,
          pointsSpent: claim.pointsSpent,
          remainingBalance: claim.remainingBalance,
          redemptionCode: claim.claimCode,
        },
      };
    } catch (err) {
      return sendLoyaltyError(reply, err);
    }
  });

  // GET /claims/:claimCode/verify — staff-safe verification flow
  app.get("/claims/:claimCode/verify", async (request, reply) => {
    const { claimCode } = request.params as { claimCode: string };
    const claim = await verifyClaimByCode(claimCode);
    if (!claim) {
      reply.code(404);
      return { error: "Claim not found" };
    }

    const err = enforceTenant(request.user!, claim.restaurantId) ?? requireOperationalRole(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    return { claim };
  });

  // POST /claims/:claimId/redeem — mark a claim as honored by staff
  app.post("/claims/:claimId/redeem", async (request, reply) => {
    const { claimId } = request.params as { claimId: string };
    const claim = await getClaimById(claimId);
    if (!claim) {
      reply.code(404);
      return { error: "Claim not found" };
    }

    const err = enforceTenant(request.user!, claim.restaurantId) ?? requireOperationalRole(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    try {
      const redeemedClaim = await redeemClaim(claimId, request.user!.id);
      return { claim: redeemedClaim };
    } catch (err) {
      return sendLoyaltyError(reply, err);
    }
  });

  // PATCH /:guestId/messaging-preferences — member club/promotional opt-out
  app.patch("/:guestId/messaging-preferences", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const body = messagingPreferencesSchema.parse(request.body ?? {});
    const guest = await getGuestById(guestId);
    if (!guest) {
      reply.code(404);
      return { error: "Guest not found" };
    }

    const err = enforceTenant(request.user!, guest.restaurantId) ?? requireOperationalRole(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const updated = await updateGuestPreferences(guestId, {
      optedOutCampaigns: body.optedOutCampaigns,
    });

    return { guest: updated ? toDomainGuest(updated) : null };
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
