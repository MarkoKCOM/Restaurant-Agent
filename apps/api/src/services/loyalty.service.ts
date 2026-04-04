import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  guests,
  loyaltyTransactions,
  rewards,
} from "../db/schema.js";
import type { InferSelectModel } from "drizzle-orm";

export type LoyaltyTransactionRow = InferSelectModel<typeof loyaltyTransactions>;
export type RewardRow = InferSelectModel<typeof rewards>;

// ── Tier config ────────────────────────────────────────

const TIER_THRESHOLDS = {
  bronze: { minVisits: 0, multiplier: 1 },
  silver: { minVisits: 5, multiplier: 1.5 },
  gold: { minVisits: 15, multiplier: 2 },
} as const;

export type Tier = "bronze" | "silver" | "gold";

const POINTS_PER_VISIT = 10;
const STAMP_CARD_SIZE = 10;
const STAMP_BONUS_POINTS = 50;

export function getTierMultiplier(tier: Tier): number {
  return TIER_THRESHOLDS[tier].multiplier;
}

// ── Points ─────────────────────────────────────────────

export async function awardPoints(
  guestId: string,
  restaurantId: string,
  points: number,
  reason: string,
  reservationId?: string,
): Promise<LoyaltyTransactionRow> {
  const [tx] = await db
    .insert(loyaltyTransactions)
    .values({
      restaurantId,
      guestId,
      type: "earn",
      points,
      reason,
      reservationId: reservationId ?? null,
    })
    .returning();

  await db
    .update(guests)
    .set({
      pointsBalance: sql`${guests.pointsBalance} + ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guestId));

  return tx!;
}

export async function deductPoints(
  guestId: string,
  restaurantId: string,
  points: number,
  reason: string,
  reservationId?: string,
): Promise<LoyaltyTransactionRow> {
  const [guest] = await db
    .select({ pointsBalance: guests.pointsBalance })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest || guest.pointsBalance < points) {
    throw new Error(
      `Insufficient points: balance is ${guest?.pointsBalance ?? 0}, tried to deduct ${points}`,
    );
  }

  const [tx] = await db
    .insert(loyaltyTransactions)
    .values({
      restaurantId,
      guestId,
      type: "redeem",
      points: -points,
      reason,
      reservationId: reservationId ?? null,
    })
    .returning();

  await db
    .update(guests)
    .set({
      pointsBalance: sql`${guests.pointsBalance} - ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guestId));

  return tx!;
}

export async function getPointsBalance(
  guestId: string,
): Promise<{ pointsBalance: number; tier: Tier } | null> {
  const [guest] = await db
    .select({
      pointsBalance: guests.pointsBalance,
      tier: guests.tier,
    })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) return null;

  return {
    pointsBalance: guest.pointsBalance,
    tier: (guest.tier ?? "bronze") as Tier,
  };
}

export async function getTransactionHistory(
  guestId: string,
  limit = 20,
): Promise<LoyaltyTransactionRow[]> {
  return db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.guestId, guestId))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit);
}

// ── Stamps ─────────────────────────────────────────────

export interface StampCardStatus {
  visits: number;
  stampsNeeded: number;
  stampsUntilReward: number;
  earned: number;
}

export async function checkStampCard(
  guestId: string,
): Promise<StampCardStatus | null> {
  const [guest] = await db
    .select({ visitCount: guests.visitCount })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) return null;

  const visits = guest.visitCount;
  return {
    visits,
    stampsNeeded: STAMP_CARD_SIZE,
    stampsUntilReward: STAMP_CARD_SIZE - (visits % STAMP_CARD_SIZE),
    earned: Math.floor(visits / STAMP_CARD_SIZE),
  };
}

// ── Tiers ──────────────────────────────────────────────

export interface TierEvaluation {
  oldTier: Tier;
  newTier: Tier;
  changed: boolean;
}

export async function evaluateTier(guestId: string): Promise<TierEvaluation | null> {
  const [guest] = await db
    .select({ visitCount: guests.visitCount, tier: guests.tier })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) return null;

  const oldTier = (guest.tier ?? "bronze") as Tier;
  let newTier: Tier = "bronze";

  if (guest.visitCount >= TIER_THRESHOLDS.gold.minVisits) {
    newTier = "gold";
  } else if (guest.visitCount >= TIER_THRESHOLDS.silver.minVisits) {
    newTier = "silver";
  }

  const changed = oldTier !== newTier;

  if (changed) {
    await db
      .update(guests)
      .set({ tier: newTier, updatedAt: new Date() })
      .where(eq(guests.id, guestId));
  }

  return { oldTier, newTier, changed };
}

// ── Rewards ────────────────────────────────────────────

export async function listRewards(
  restaurantId: string,
): Promise<RewardRow[]> {
  return db
    .select()
    .from(rewards)
    .where(
      and(eq(rewards.restaurantId, restaurantId), eq(rewards.isActive, true)),
    );
}

export async function createReward(data: {
  restaurantId: string;
  nameHe: string;
  nameEn?: string;
  description?: string;
  pointsCost: number;
}): Promise<RewardRow> {
  const [row] = await db
    .insert(rewards)
    .values({
      restaurantId: data.restaurantId,
      nameHe: data.nameHe,
      nameEn: data.nameEn ?? null,
      description: data.description ?? null,
      pointsCost: data.pointsCost,
    })
    .returning();

  return row!;
}

function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface RedemptionResult {
  transactionId: string;
  rewardName: string;
  pointsSpent: number;
  remainingBalance: number;
  redemptionCode: string;
}

export async function redeemReward(
  guestId: string,
  restaurantId: string,
  rewardId: string,
): Promise<RedemptionResult> {
  const [reward] = await db
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, rewardId), eq(rewards.isActive, true)))
    .limit(1);

  if (!reward) {
    throw new Error("Reward not found or inactive");
  }

  if (reward.restaurantId !== restaurantId) {
    throw new Error("Reward does not belong to this restaurant");
  }

  const redemptionCode = generateRedemptionCode();
  const tx = await deductPoints(
    guestId,
    restaurantId,
    reward.pointsCost,
    `redeem_reward:${reward.nameHe}`,
  );

  const [guest] = await db
    .select({ pointsBalance: guests.pointsBalance })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  return {
    transactionId: tx.id,
    rewardName: reward.nameHe,
    pointsSpent: reward.pointsCost,
    remainingBalance: guest?.pointsBalance ?? 0,
    redemptionCode,
  };
}

// ── Visit completion hook ──────────────────────────────

export async function onVisitCompleted(
  guestId: string,
  restaurantId: string,
  reservationId: string,
): Promise<{
  pointsAwarded: number;
  stampBonus: boolean;
  tierChange: TierEvaluation | null;
}> {
  // Guest visitCount was already incremented before this call
  const [guest] = await db
    .select({ tier: guests.tier, visitCount: guests.visitCount })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) {
    throw new Error("Guest not found");
  }

  const tier = (guest.tier ?? "bronze") as Tier;
  const multiplier = getTierMultiplier(tier);
  const pointsForVisit = Math.round(POINTS_PER_VISIT * multiplier);

  // Award visit points
  await awardPoints(guestId, restaurantId, pointsForVisit, "visit_completion", reservationId);

  // Check stamp card — every 10th visit gets bonus
  let stampBonus = false;
  if (guest.visitCount % STAMP_CARD_SIZE === 0 && guest.visitCount > 0) {
    await awardPoints(guestId, restaurantId, STAMP_BONUS_POINTS, "stamp_card_bonus", reservationId);
    stampBonus = true;
  }

  // Evaluate tier
  const tierChange = await evaluateTier(guestId);

  return {
    pointsAwarded: pointsForVisit + (stampBonus ? STAMP_BONUS_POINTS : 0),
    stampBonus,
    tierChange,
  };
}
