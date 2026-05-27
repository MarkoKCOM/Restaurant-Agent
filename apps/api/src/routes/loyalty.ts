import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
import { getReferralShare } from "../services/referral.service.js";
import {
  claimReward,
  getClaimById,
  redeemClaim,
  verifyClaimByCode,
} from "../services/reward-claims.service.js";
import { getGuestById, toDomainGuest, updateGuestPreferences } from "../services/guest.service.js";
import {
  listMembershipProcessingFailures,
  retryMembershipProcessingFailure,
} from "../services/membership-processing.service.js";
import {
  enforceTenant,
  requireGrowthPackage,
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
  templateKey: z.string().min(1).optional(),
  recommendedMoments: z.array(z.string().min(1)).optional(),
  pitchHe: z.string().optional(),
  pitchEn: z.string().optional(),
});

const updateRewardSchema = z.object({
  nameHe: z.string().min(1).optional(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  pointsCost: z.coerce.number().int().min(1).optional(),
  templateKey: z.string().min(1).nullable().optional(),
  recommendedMoments: z.array(z.string().min(1)).nullable().optional(),
  pitchHe: z.string().nullable().optional(),
  pitchEn: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const claimRewardSchema = z.object({
  reservationId: z.string().uuid().optional(),
});

const messagingPreferencesSchema = z.object({
  optedOutCampaigns: z.boolean(),
});

const processingFailuresQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  status: z.enum(["open", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function sendLoyaltyEnvelopeError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
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
    request.log.error(logPayload, "Loyalty request failed");
  } else {
    request.log.warn(logPayload, "Loyalty request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
    ...extra,
  });
}

function loyaltyOperationErrorCode(message: string): string {
  if (message.includes("Insufficient points")) return "LOYALTY_INSUFFICIENT_POINTS";
  if (message.includes("Reward not found")) return "LOYALTY_REWARD_NOT_FOUND";
  if (message.includes("Claim not found")) return "LOYALTY_CLAIM_NOT_FOUND";
  if (message.includes("Guest not found")) return "LOYALTY_GUEST_NOT_FOUND";
  if (message.includes("not belong") || message.includes("does not belong")) {
    return "LOYALTY_TENANT_MISMATCH";
  }
  if (message.includes("already")) return "LOYALTY_CLAIM_NOT_ACTIVE";
  return "LOYALTY_OPERATION_FAILED";
}

function sendLoyaltyError(
  request: FastifyRequest,
  reply: FastifyReply,
  err: unknown,
  context: Record<string, unknown> = {},
) {
  const message = err instanceof Error ? err.message : "Loyalty operation failed";
  const code = loyaltyOperationErrorCode(message);
  if (message.includes("Insufficient points")) {
    return sendLoyaltyEnvelopeError(request, reply, 400, message, code, context);
  }
  if (
    message.includes("not found")
    || message.includes("not belong")
    || message.includes("does not belong")
  ) {
    return sendLoyaltyEnvelopeError(request, reply, 404, message, code, context);
  }
  if (message.includes("already")) {
    return sendLoyaltyEnvelopeError(request, reply, 409, message, code, context);
  }
  return sendLoyaltyEnvelopeError(request, reply, 500, message, code, context);
}

function sendCaughtLoyaltyRouteError(
  request: FastifyRequest,
  reply: FastifyReply,
  err: unknown,
  fallbackCode: string,
  context: Record<string, unknown> = {},
) {
  const message = err instanceof Error ? err.message : "Loyalty operation failed";
  const code = loyaltyOperationErrorCode(message);
  if (code !== "LOYALTY_OPERATION_FAILED") {
    return sendLoyaltyError(request, reply, err, context);
  }

  return sendLoyaltyEnvelopeError(request, reply, 500, message, fallbackCode, {
    ...context,
    err,
  });
}

async function loadLoyaltyGuest(
  request: FastifyRequest,
  reply: FastifyReply,
  guestId: string,
  failureCode: string,
  context: Record<string, unknown> = {},
) {
  try {
    const guest = await getGuestById(guestId);
    if (!guest) {
      sendLoyaltyEnvelopeError(
        request,
        reply,
        404,
        "Guest not found",
        "LOYALTY_GUEST_NOT_FOUND",
        { ...context, guestId },
      );
      return null;
    }

    return guest;
  } catch (error: unknown) {
    sendCaughtLoyaltyRouteError(request, reply, error, failureCode, { ...context, guestId });
    return null;
  }
}

async function loadLoyaltyClaim(
  request: FastifyRequest,
  reply: FastifyReply,
  claimId: string,
  failureCode: string,
  context: Record<string, unknown> = {},
) {
  try {
    const claim = await getClaimById(claimId);
    if (!claim) {
      sendLoyaltyEnvelopeError(
        request,
        reply,
        404,
        "Claim not found",
        "LOYALTY_CLAIM_NOT_FOUND",
        { ...context, claimId },
      );
      return null;
    }

    return claim;
  } catch (error: unknown) {
    sendCaughtLoyaltyRouteError(request, reply, error, failureCode, { ...context, claimId });
    return null;
  }
}

async function enforceLoyaltyAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  restaurantId: string,
  code: string,
  context: Record<string, unknown> = {},
  roleGuard: typeof requireRestaurantAdmin | typeof requireOperationalRole = requireRestaurantAdmin,
) {
  const accessError = enforceTenant(request.user!, restaurantId) ?? roleGuard(request.user!);
  if (accessError) {
    sendLoyaltyEnvelopeError(
      request,
      reply,
      403,
      accessError,
      code,
      { ...context, restaurantId },
    );
    return true;
  }

  const packageAccess = await requireGrowthPackage(restaurantId);
  if (!packageAccess.ok) {
    sendLoyaltyEnvelopeError(
      request,
      reply,
      packageAccess.code === "RESTAURANT_NOT_FOUND" ? 404 : 403,
      packageAccess.error ?? "Growth package required",
      packageAccess.code ?? "PACKAGE_GROWTH_REQUIRED",
      { ...context, restaurantId, restaurantPackage: packageAccess.restaurantPackage, requiredPackage: "growth" },
      { restaurantId, restaurantPackage: packageAccess.restaurantPackage, requiredPackage: "growth" },
    );
    return true;
  }

  return false;
}

export async function loyaltyRoutes(app: FastifyInstance) {
  // GET /processing-failures — post-visit membership processing failures
  app.get("/processing-failures", async (request, reply) => {
    const query = processingFailuresQuerySchema.parse(request.query);
    const accessError = await enforceLoyaltyAccess(request, reply, query.restaurantId, "MEMBERSHIP_PROCESSING_FORBIDDEN");
    if (accessError) return reply;

    try {
      const failures = await listMembershipProcessingFailures(query);
      return { failures };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "MEMBERSHIP_PROCESSING_LIST_FAILED",
        { restaurantId: query.restaurantId, status: query.status, limit: query.limit },
      );
    }
  });

  // POST /processing-failures/:failureId/retry — retry one failed post-visit stage
  app.post("/processing-failures/:failureId/retry", async (request, reply) => {
    const { failureId } = request.params as { failureId: string };
    const body = z.object({ restaurantId: z.string().uuid() }).parse(request.body);
    const accessError = await enforceLoyaltyAccess(
      request,
      reply,
      body.restaurantId,
      "MEMBERSHIP_PROCESSING_FORBIDDEN",
      { failureId },
    );
    if (accessError) return reply;

    try {
      const failure = await retryMembershipProcessingFailure({
        failureId,
        restaurantId: body.restaurantId,
      });

      if (!failure) {
        return sendLoyaltyEnvelopeError(
          request,
          reply,
          404,
          "Membership processing failure not found",
          "MEMBERSHIP_PROCESSING_FAILURE_NOT_FOUND",
          { failureId, restaurantId: body.restaurantId },
        );
      }

      return { failure };
    } catch (error: unknown) {
      const failure = (error as { failure?: unknown }).failure;
      return sendLoyaltyEnvelopeError(
        request,
        reply,
        409,
        error instanceof Error ? error.message : "Membership processing retry failed",
        "MEMBERSHIP_PROCESSING_RETRY_FAILED",
        { err: error, failureId, restaurantId: body.restaurantId },
        { failure },
      );
    }
  });

  // GET /:guestId/referral-share — WhatsApp-ready referral code/share copy
  app.get("/:guestId/referral-share", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_REFERRAL_SHARE_GUEST_LOOKUP_FAILED");
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(request, reply, guest.restaurantId, "LOYALTY_FORBIDDEN", { guestId });
    if (accessError) return reply;

    try {
      const referralShare = await getReferralShare(guestId);
      return { referralShare };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_REFERRAL_SHARE_FAILED",
        { guestId, restaurantId: guest.restaurantId },
      );
    }
  });

  // GET /:guestId/balance — points balance + tier + stamp progress
  app.get("/:guestId/balance", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_BALANCE_GUEST_LOOKUP_FAILED");
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(request, reply, guest.restaurantId, "LOYALTY_FORBIDDEN", { guestId });
    if (accessError) return reply;

    try {
      const balance = await getPointsBalance(guestId);
      if (!balance) {
        return sendLoyaltyEnvelopeError(
          request,
          reply,
          404,
          "Guest not found",
          "LOYALTY_GUEST_NOT_FOUND",
          { guestId },
        );
      }

      const stampCard = await checkStampCard(guestId);

      return {
        guestId,
        pointsBalance: balance.pointsBalance,
        tier: balance.tier,
        stampCard,
      };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_BALANCE_FAILED",
        { guestId, restaurantId: guest.restaurantId },
      );
    }
  });

  // GET /:guestId/history — transaction history
  app.get("/:guestId/history", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const { limit } = request.query as { limit?: string };
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_HISTORY_GUEST_LOOKUP_FAILED", { limit });
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(request, reply, guest.restaurantId, "LOYALTY_FORBIDDEN", { guestId });
    if (accessError) return reply;

    try {
      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
      const transactions = await getTransactionHistory(guestId, parsedLimit);

      return {
        transactions: transactions.map((tx) => ({
          ...tx,
          description: tx.reason ?? tx.type,
        })),
      };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_HISTORY_FAILED",
        { guestId, restaurantId: guest.restaurantId, limit },
      );
    }
  });

  // GET /:guestId/summary — normalized WhatsApp/member summary
  app.get("/:guestId/summary", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await loadLoyaltyGuest(request, reply, guestId, "MEMBERSHIP_SUMMARY_GUEST_LOOKUP_FAILED");
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(request, reply, guest.restaurantId, "LOYALTY_FORBIDDEN", { guestId });
    if (accessError) return reply;

    try {
      const summary = await getMembershipSummary(guestId);
      if (!summary) {
        return sendLoyaltyEnvelopeError(
          request,
          reply,
          404,
          "Guest not found",
          "LOYALTY_GUEST_NOT_FOUND",
          { guestId },
        );
      }

      return { summary };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "MEMBERSHIP_SUMMARY_FAILED",
        { guestId, restaurantId: guest.restaurantId },
      );
    }
  });

  // POST /:guestId/award — manual point award (owner action)
  app.post("/:guestId/award", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const body = awardPointsSchema.parse(request.body);
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_AWARD_GUEST_LOOKUP_FAILED", {
      points: body.points,
      reason: body.reason,
    });
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(request, reply, guest.restaurantId, "LOYALTY_FORBIDDEN", { guestId });
    if (accessError) return reply;

    try {
      const transaction = await awardPoints(
        guestId,
        guest.restaurantId,
        body.points,
        body.reason,
      );

      reply.code(201);
      return { transaction };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_AWARD_FAILED",
        { guestId, restaurantId: guest.restaurantId, points: body.points, reason: body.reason },
      );
    }
  });

  // GET /rewards — list rewards for a restaurant
  app.get("/rewards", async (request, reply) => {
    const { restaurantId, includeInactive } = request.query as {
      restaurantId?: string;
      includeInactive?: string;
    };

    if (!restaurantId) {
      return sendLoyaltyEnvelopeError(
        request,
        reply,
        400,
        "restaurantId query parameter is required",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const accessError = await enforceLoyaltyAccess(request, reply, restaurantId, "LOYALTY_FORBIDDEN");
    if (accessError) return reply;

    try {
      const rewardsList = await listRewards(restaurantId, includeInactive === "true");
      return { rewards: rewardsList };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_REWARDS_LIST_FAILED",
        { restaurantId, includeInactive },
      );
    }
  });

  // PATCH /rewards/:rewardId — update reward fields (admin/super_admin)
  app.patch("/rewards/:rewardId", async (request, reply) => {
    const { rewardId } = request.params as { rewardId: string };
    const body = updateRewardSchema.parse(request.body ?? {});

    const restaurantId = request.user!.restaurantId;
    if (!restaurantId) {
      return sendLoyaltyEnvelopeError(
        request,
        reply,
        400,
        "Restaurant context required",
        "RESTAURANT_ID_REQUIRED",
        { rewardId },
      );
    }

    const accessError = await enforceLoyaltyAccess(request, reply, restaurantId, "LOYALTY_FORBIDDEN", { rewardId });
    if (accessError) return reply;

    try {
      const updated = await updateReward(rewardId, restaurantId, body);
      if (!updated) {
        return sendLoyaltyEnvelopeError(
          request,
          reply,
          404,
          "Reward not found",
          "LOYALTY_REWARD_NOT_FOUND",
          { rewardId, restaurantId },
        );
      }

      return { reward: updated };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_REWARD_UPDATE_FAILED",
        { rewardId, restaurantId },
      );
    }
  });

  // POST /rewards — create a reward
  app.post("/rewards", async (request, reply) => {
    const parsed = createRewardSchema.parse(request.body);
    const accessError = await enforceLoyaltyAccess(request, reply, parsed.restaurantId!, "LOYALTY_FORBIDDEN");
    if (accessError) return reply;

    try {
      const reward = await createReward({
        restaurantId: parsed.restaurantId!,
        nameHe: parsed.nameHe!,
        nameEn: parsed.nameEn,
        description: parsed.description,
        pointsCost: parsed.pointsCost!,
        templateKey: parsed.templateKey,
        recommendedMoments: parsed.recommendedMoments,
        pitchHe: parsed.pitchHe,
        pitchEn: parsed.pitchEn,
      });
      reply.code(201);
      return { reward };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_REWARD_CREATE_FAILED",
        { restaurantId: parsed.restaurantId, pointsCost: parsed.pointsCost, templateKey: parsed.templateKey },
      );
    }
  });

  // POST /:guestId/rewards/:rewardId/claim — claim a reward for later redemption
  app.post("/:guestId/rewards/:rewardId/claim", async (request, reply) => {
    const { guestId, rewardId } = request.params as { guestId: string; rewardId: string };
    const body = claimRewardSchema.parse(request.body ?? {});
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_REWARD_CLAIM_GUEST_LOOKUP_FAILED", {
      rewardId,
      reservationId: body.reservationId,
    });
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(
      request,
      reply,
      guest.restaurantId,
      "LOYALTY_FORBIDDEN",
      { guestId, rewardId },
      requireOperationalRole,
    );
    if (accessError) return reply;

    try {
      const claim = await claimReward(guestId, rewardId, body.reservationId);
      reply.code(201);
      return { claim };
    } catch (err) {
      return sendLoyaltyError(request, reply, err, { guestId, rewardId, restaurantId: guest.restaurantId });
    }
  });

  // POST /:guestId/redeem/:rewardId — backwards-compatible alias for claim flow
  app.post("/:guestId/redeem/:rewardId", async (request, reply) => {
    const { guestId, rewardId } = request.params as { guestId: string; rewardId: string };
    const body = claimRewardSchema.parse(request.body ?? {});
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_REWARD_REDEEM_GUEST_LOOKUP_FAILED", {
      rewardId,
      reservationId: body.reservationId,
    });
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(
      request,
      reply,
      guest.restaurantId,
      "LOYALTY_FORBIDDEN",
      { guestId, rewardId },
      requireOperationalRole,
    );
    if (accessError) return reply;

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
      return sendLoyaltyError(request, reply, err, { guestId, rewardId, restaurantId: guest.restaurantId });
    }
  });

  // GET /claims/:claimCode/verify — staff-safe verification flow
  app.get("/claims/:claimCode/verify", async (request, reply) => {
    const { claimCode } = request.params as { claimCode: string };
    let claim: Awaited<ReturnType<typeof verifyClaimByCode>>;
    try {
      claim = await verifyClaimByCode(claimCode);
      if (!claim) {
        return sendLoyaltyEnvelopeError(
          request,
          reply,
          404,
          "Claim not found",
          "LOYALTY_CLAIM_NOT_FOUND",
          { claimCode },
        );
      }
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_CLAIM_VERIFY_FAILED",
        { claimCode },
      );
    }

    const accessError = await enforceLoyaltyAccess(
      request,
      reply,
      claim.restaurantId,
      "LOYALTY_FORBIDDEN",
      { claimCode, claimId: claim.id },
      requireOperationalRole,
    );
    if (accessError) return reply;

    return { claim };
  });

  // POST /claims/:claimId/redeem — mark a claim as honored by staff
  app.post("/claims/:claimId/redeem", async (request, reply) => {
    const { claimId } = request.params as { claimId: string };
    const claim = await loadLoyaltyClaim(request, reply, claimId, "LOYALTY_CLAIM_LOOKUP_FAILED");
    if (!claim) return reply;

    const accessError = await enforceLoyaltyAccess(
      request,
      reply,
      claim.restaurantId,
      "LOYALTY_FORBIDDEN",
      { claimId },
      requireOperationalRole,
    );
    if (accessError) return reply;

    try {
      const redeemedClaim = await redeemClaim(claimId, request.user!.id);
      return { claim: redeemedClaim };
    } catch (err) {
      return sendLoyaltyError(request, reply, err, { claimId, restaurantId: claim.restaurantId });
    }
  });

  // PATCH /:guestId/messaging-preferences — member club/promotional opt-out
  app.patch("/:guestId/messaging-preferences", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const body = messagingPreferencesSchema.parse(request.body ?? {});
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_MESSAGING_PREFERENCES_GUEST_LOOKUP_FAILED", {
      optedOutCampaigns: body.optedOutCampaigns,
    });
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(
      request,
      reply,
      guest.restaurantId,
      "LOYALTY_FORBIDDEN",
      { guestId },
      requireOperationalRole,
    );
    if (accessError) return reply;

    try {
      const updated = await updateGuestPreferences(guestId, {
        optedOutCampaigns: body.optedOutCampaigns,
      });

      return { guest: updated ? toDomainGuest(updated) : null };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_MESSAGING_PREFERENCES_FAILED",
        { guestId, restaurantId: guest.restaurantId, optedOutCampaigns: body.optedOutCampaigns },
      );
    }
  });

  // GET /:guestId/stamp-card — stamp card status
  app.get("/:guestId/stamp-card", async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await loadLoyaltyGuest(request, reply, guestId, "LOYALTY_STAMP_CARD_GUEST_LOOKUP_FAILED");
    if (!guest) return reply;

    const accessError = await enforceLoyaltyAccess(request, reply, guest.restaurantId, "LOYALTY_FORBIDDEN", { guestId });
    if (accessError) return reply;

    try {
      const stampCard = await checkStampCard(guestId);
      if (!stampCard) {
        return sendLoyaltyEnvelopeError(
          request,
          reply,
          404,
          "Guest not found",
          "LOYALTY_GUEST_NOT_FOUND",
          { guestId },
        );
      }

      return { stampCard };
    } catch (error: unknown) {
      return sendCaughtLoyaltyRouteError(
        request,
        reply,
        error,
        "LOYALTY_STAMP_CARD_FAILED",
        { guestId, restaurantId: guest.restaurantId },
      );
    }
  });
}
