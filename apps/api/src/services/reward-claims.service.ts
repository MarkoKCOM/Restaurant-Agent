import { deductPoints } from "./loyalty.service.js";
import { rewardClaimRepository } from "../repositories/reward-claim.repository.js";
import { rewardRepository } from "../repositories/reward.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";

export type { RewardClaimRow } from "../repositories/reward-claim.repository.js";
import type { RewardClaimRow } from "../repositories/reward-claim.repository.js";

function generateClaimCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function claimReward(
  guestId: string,
  rewardId: string,
  reservationId?: string,
): Promise<
  RewardClaimRow & { rewardName: string; pointsSpent: number; remainingBalance: number }
> {
  const reward = await rewardRepository.findActiveById(rewardId);

  if (!reward) throw new Error("Reward not found or inactive");

  const guest = await guestRepository.findById(guestId);

  if (!guest) throw new Error("Guest not found");

  if (guest.restaurantId !== reward.restaurantId) {
    throw new Error("Reward does not belong to guest's restaurant");
  }

  // Generate unique claim code
  let claimCode: string | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateClaimCode();
    const existing = await rewardClaimRepository.findByCode(candidate);
    if (!existing) {
      claimCode = candidate;
      break;
    }
  }

  if (!claimCode) throw new Error("Failed to generate unique claim code");

  // Deduct points (throws if insufficient)
  const tx = await deductPoints(
    guestId,
    guest.restaurantId,
    reward.pointsCost,
    `claim_reward:${reward.nameHe}`,
  );

  const claim = await rewardClaimRepository.insert({
    restaurantId: guest.restaurantId,
    guestId,
    rewardId,
    loyaltyTransactionId: tx.id,
    claimCode,
    status: "active",
    reservationId: reservationId ?? null,
  });

  if (!claim) throw new Error("Failed to create reward claim");

  const updatedGuest = await guestRepository.findById(guestId);

  return {
    ...claim,
    rewardName: reward.nameHe,
    pointsSpent: reward.pointsCost,
    remainingBalance: updatedGuest?.pointsBalance ?? 0,
  };
}

export async function verifyClaimByCode(
  claimCode: string,
): Promise<(RewardClaimRow & { rewardName: string; guestName: string }) | null> {
  const claim = await rewardClaimRepository.findByCode(claimCode.toUpperCase());

  if (!claim) return null;

  const reward = await rewardRepository.findById(claim.rewardId);
  const guest = await guestRepository.findById(claim.guestId);

  return {
    ...claim,
    rewardName: reward?.nameHe ?? "",
    guestName: guest?.name ?? "",
  };
}

export async function getClaimById(
  claimId: string,
): Promise<(RewardClaimRow & { rewardName: string; guestName: string }) | null> {
  const claim = await rewardClaimRepository.findById(claimId);

  if (!claim) return null;

  const reward = await rewardRepository.findById(claim.rewardId);
  const guest = await guestRepository.findById(claim.guestId);

  return {
    ...claim,
    rewardName: reward?.nameHe ?? "",
    guestName: guest?.name ?? "",
  };
}

export async function redeemClaim(
  claimId: string,
  adminUserId: string,
): Promise<RewardClaimRow> {
  const claim = await rewardClaimRepository.findById(claimId);

  if (!claim) throw new Error("Claim not found");
  if (claim.status !== "active") throw new Error(`Claim is already ${claim.status}`);

  const updated = await rewardClaimRepository.updateById(claimId, {
    status: "redeemed",
    redeemedAt: new Date(),
    redeemedBy: adminUserId,
  });

  return updated!;
}

export async function getGuestClaims(
  guestId: string,
): Promise<Array<RewardClaimRow & { rewardName: string }>> {
  const claimRows = await rewardClaimRepository.findByGuest(guestId);

  if (!claimRows.length) return [];

  const uniqueRewardIds = [...new Set(claimRows.map((c) => c.rewardId))];
  const rewardRows = await rewardRepository.findByIds(uniqueRewardIds);

  const rewardMap = new Map(rewardRows.map((r) => [r.id, r.nameHe]));

  return claimRows.map((c) => ({ ...c, rewardName: rewardMap.get(c.rewardId) ?? "" }));
}
