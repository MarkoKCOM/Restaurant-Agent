import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, rewardClaims, rewards } from "../db/schema.js";
import { deductPoints } from "./loyalty.service.js";

export type RewardClaimRow = InferSelectModel<typeof rewardClaims>;

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
  const [reward] = await db
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, rewardId), eq(rewards.isActive, true)))
    .limit(1);

  if (!reward) throw new Error("Reward not found or inactive");

  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) throw new Error("Guest not found");

  if (guest.restaurantId !== reward.restaurantId) {
    throw new Error("Reward does not belong to guest's restaurant");
  }

  // Generate unique claim code
  let claimCode: string | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateClaimCode();
    const [existing] = await db
      .select({ id: rewardClaims.id })
      .from(rewardClaims)
      .where(eq(rewardClaims.claimCode, candidate))
      .limit(1);
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

  const [claim] = await db
    .insert(rewardClaims)
    .values({
      restaurantId: guest.restaurantId,
      guestId,
      rewardId,
      loyaltyTransactionId: tx.id,
      claimCode,
      status: "active",
      reservationId: reservationId ?? null,
    })
    .returning();

  if (!claim) throw new Error("Failed to create reward claim");

  const [updatedGuest] = await db
    .select({ pointsBalance: guests.pointsBalance })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

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
  const [claim] = await db
    .select()
    .from(rewardClaims)
    .where(eq(rewardClaims.claimCode, claimCode.toUpperCase()))
    .limit(1);

  if (!claim) return null;

  const [reward] = await db
    .select({ nameHe: rewards.nameHe })
    .from(rewards)
    .where(eq(rewards.id, claim.rewardId))
    .limit(1);

  const [guest] = await db
    .select({ name: guests.name })
    .from(guests)
    .where(eq(guests.id, claim.guestId))
    .limit(1);

  return {
    ...claim,
    rewardName: reward?.nameHe ?? "",
    guestName: guest?.name ?? "",
  };
}

export async function getClaimById(
  claimId: string,
): Promise<(RewardClaimRow & { rewardName: string; guestName: string }) | null> {
  const [claim] = await db
    .select()
    .from(rewardClaims)
    .where(eq(rewardClaims.id, claimId))
    .limit(1);

  if (!claim) return null;

  const [reward] = await db
    .select({ nameHe: rewards.nameHe })
    .from(rewards)
    .where(eq(rewards.id, claim.rewardId))
    .limit(1);

  const [guest] = await db
    .select({ name: guests.name })
    .from(guests)
    .where(eq(guests.id, claim.guestId))
    .limit(1);

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
  const [claim] = await db
    .select()
    .from(rewardClaims)
    .where(eq(rewardClaims.id, claimId))
    .limit(1);

  if (!claim) throw new Error("Claim not found");
  if (claim.status !== "active") throw new Error(`Claim is already ${claim.status}`);

  const [updated] = await db
    .update(rewardClaims)
    .set({
      status: "redeemed",
      redeemedAt: new Date(),
      redeemedBy: adminUserId,
    })
    .where(eq(rewardClaims.id, claimId))
    .returning();

  return updated!;
}

export async function getGuestClaims(
  guestId: string,
): Promise<Array<RewardClaimRow & { rewardName: string }>> {
  const claimRows = await db
    .select()
    .from(rewardClaims)
    .where(eq(rewardClaims.guestId, guestId))
    .orderBy(desc(rewardClaims.claimedAt));

  if (!claimRows.length) return [];

  const uniqueRewardIds = [...new Set(claimRows.map((c) => c.rewardId))];
  const rewardRows = await db
    .select({ id: rewards.id, nameHe: rewards.nameHe })
    .from(rewards)
    .where(inArray(rewards.id, uniqueRewardIds));

  const rewardMap = new Map(rewardRows.map((r) => [r.id, r.nameHe]));

  return claimRows.map((c) => ({ ...c, rewardName: rewardMap.get(c.rewardId) ?? "" }));
}
