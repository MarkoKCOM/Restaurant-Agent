import { createHash } from "node:crypto";
import { db } from "../db/index.js";
import { scheduleLuckySpinReward } from "./engagement.service.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { reservationRepository } from "../repositories/reservation.repository.js";
import {
  loyaltyTransactionRepository,
  type LoyaltyTransactionRow,
} from "../repositories/loyalty-transaction.repository.js";
import { rewardRepository, type RewardRow } from "../repositories/reward.repository.js";

export type { LoyaltyTransactionRow } from "../repositories/loyalty-transaction.repository.js";
export type { RewardRow } from "../repositories/reward.repository.js";

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
const HOST_GROUP_MIN_PARTY_SIZE = 6;
const HOST_GROUP_BONUS_POINTS = 20;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type DayKey = (typeof DAY_KEYS)[number];

interface OffPeakMultiplierConfig {
  start: string;
  end: string;
  multiplier: number;
  days?: DayKey[];
  enabled?: boolean;
}

interface LuckySpinPrizeConfig {
  key: string;
  labelHe?: string;
  labelEn?: string;
  points: number;
  weight: number;
  enabled?: boolean;
}

interface LuckySpinConfig {
  enabled: boolean;
  triggerEvery: number;
  prizePool: LuckySpinPrizeConfig[];
}

export interface LuckySpinResult {
  eligible: boolean;
  alreadyAwarded: boolean;
  prize: {
    key: string;
    labelHe: string;
    labelEn: string;
    points: number;
  } | null;
  transactionId: string | null;
  engagementJobId: string | null;
}

export function getTierMultiplier(tier: Tier): number {
  return TIER_THRESHOLDS[tier].multiplier;
}

function minutesFromHHMM(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dayKeyFromDate(value: string): DayKey | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return DAY_KEYS[new Date(`${value}T12:00:00`).getDay()] ?? null;
}

function getConfiguredOffPeakMultiplier(
  dashboardConfig: unknown,
  reservationDate: string,
  timeStart: string,
): number {
  const loyaltyConfig = typeof dashboardConfig === "object" && dashboardConfig !== null
    ? (dashboardConfig as { loyalty?: { offPeakMultipliers?: unknown } }).loyalty
    : undefined;
  const windows = Array.isArray(loyaltyConfig?.offPeakMultipliers)
    ? loyaltyConfig.offPeakMultipliers
    : [];
  const reservationMinutes = minutesFromHHMM(timeStart);
  const reservationDay = dayKeyFromDate(reservationDate);
  if (reservationMinutes === null || reservationDay === null) return 1;

  return windows.reduce((best, rawWindow) => {
    if (typeof rawWindow !== "object" || rawWindow === null) return best;
    const window = rawWindow as Partial<OffPeakMultiplierConfig>;
    if (window.enabled === false) return best;
    if (typeof window.start !== "string" || typeof window.end !== "string") return best;
    if (typeof window.multiplier !== "number" || !Number.isFinite(window.multiplier)) return best;
    if (window.multiplier <= 1) return best;
    if (window.days && (!Array.isArray(window.days) || !window.days.includes(reservationDay))) {
      return best;
    }

    const start = minutesFromHHMM(window.start);
    const end = minutesFromHHMM(window.end);
    if (start === null || end === null || start === end) return best;
    const inWindow = start < end
      ? reservationMinutes >= start && reservationMinutes < end
      : reservationMinutes >= start || reservationMinutes < end;
    return inWindow ? Math.max(best, Math.min(window.multiplier, 5)) : best;
  }, 1);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeLuckySpinPrize(rawPrize: unknown): LuckySpinPrizeConfig | null {
  const prize = objectRecord(rawPrize);
  const key = typeof prize.key === "string" && prize.key.trim().length > 0 ? prize.key.trim() : null;
  const points = typeof prize.points === "number" && Number.isFinite(prize.points) ? Math.max(0, Math.round(prize.points)) : null;
  const weight = typeof prize.weight === "number" && Number.isFinite(prize.weight) ? prize.weight : null;
  if (!key || points === null || weight === null || weight <= 0) return null;

  return {
    key,
    labelHe: typeof prize.labelHe === "string" && prize.labelHe.trim().length > 0 ? prize.labelHe.trim() : undefined,
    labelEn: typeof prize.labelEn === "string" && prize.labelEn.trim().length > 0 ? prize.labelEn.trim() : undefined,
    points,
    weight,
    enabled: typeof prize.enabled === "boolean" ? prize.enabled : undefined,
  };
}

export function getConfiguredLuckySpin(dashboardConfig: unknown): LuckySpinConfig {
  const dashboard = objectRecord(dashboardConfig);
  const gamification = objectRecord(dashboard.gamification);
  const luckySpin = objectRecord(gamification.luckySpin);
  const enabled = luckySpin.enabled === true;
  const triggerEvery = typeof luckySpin.triggerEvery === "number" && Number.isFinite(luckySpin.triggerEvery)
    ? Math.max(1, Math.round(luckySpin.triggerEvery))
    : 5;
  const prizePool = Array.isArray(luckySpin.prizePool)
    ? luckySpin.prizePool.flatMap((prize) => {
      const normalized = normalizeLuckySpinPrize(prize);
      return normalized && normalized.enabled !== false ? [normalized] : [];
    })
    : [];

  return {
    enabled,
    triggerEvery,
    prizePool,
  };
}

function deterministicLuckySpinRoll(seed: string): number {
  const hash = createHash("sha256").update(seed).digest();
  const value = hash.readUInt32BE(0);
  return value / 0xffffffff;
}

function pickLuckySpinPrize(config: LuckySpinConfig, seed: string): LuckySpinPrizeConfig | null {
  const totalWeight = config.prizePool.reduce((sum, prize) => sum + prize.weight, 0);
  if (totalWeight <= 0) return null;

  let cursor = deterministicLuckySpinRoll(seed) * totalWeight;
  for (const prize of config.prizePool) {
    cursor -= prize.weight;
    if (cursor <= 0) return prize;
  }
  return config.prizePool.at(-1) ?? null;
}

async function awardLuckySpinForVisit(params: {
  guestId: string;
  restaurantId: string;
  reservationId: string;
  visitCount: number;
  dashboardConfig: unknown;
}): Promise<LuckySpinResult> {
  const config = getConfiguredLuckySpin(params.dashboardConfig);
  if (!config.enabled || params.visitCount <= 0 || params.visitCount % config.triggerEvery !== 0) {
    return { eligible: false, alreadyAwarded: false, prize: null, transactionId: null, engagementJobId: null };
  }

  const existingSpin = await loyaltyTransactionRepository.findLuckySpinForVisit(
    params.guestId,
    params.restaurantId,
    params.reservationId,
  );

  if (existingSpin) {
    const existingPrizeKey = existingSpin.reason?.replace(/^lucky_spin:/, "") ?? "unknown";
    return {
      eligible: true,
      alreadyAwarded: true,
      prize: {
        key: existingPrizeKey,
        labelHe: existingPrizeKey,
        labelEn: existingPrizeKey,
        points: Number(existingSpin.points),
      },
      transactionId: existingSpin.id,
      engagementJobId: null,
    };
  }

  const prize = pickLuckySpinPrize(config, `${params.restaurantId}:${params.guestId}:${params.reservationId}:${params.visitCount}`);
  if (!prize) {
    return { eligible: true, alreadyAwarded: false, prize: null, transactionId: null, engagementJobId: null };
  }

  const transaction = await awardPoints(
    params.guestId,
    params.restaurantId,
    prize.points,
    `lucky_spin:${prize.key}`,
    params.reservationId,
  );
  const engagementJob = await scheduleLuckySpinReward(params.guestId, params.restaurantId);

  return {
    eligible: true,
    alreadyAwarded: false,
    prize: {
      key: prize.key,
      labelHe: prize.labelHe ?? prize.key,
      labelEn: prize.labelEn ?? prize.key,
      points: prize.points,
    },
    transactionId: transaction.id,
    engagementJobId: engagementJob.id,
  };
}

// ── Points ─────────────────────────────────────────────

export async function awardPoints(
  guestId: string,
  restaurantId: string,
  points: number,
  reason: string,
  reservationId?: string,
): Promise<LoyaltyTransactionRow> {
  // Ledger entry + balance update must commit together — otherwise a crash
  // between them leaves an orphan transaction or an unbalanced guest.
  return db.transaction(async (trx) => {
    const tx = await loyaltyTransactionRepository.insert({
      restaurantId,
      guestId,
      type: "earn",
      points,
      reason,
      reservationId: reservationId ?? null,
    }, trx);

    await guestRepository.adjustPoints(guestId, points, trx);

    return tx;
  });
}

export async function deductPoints(
  guestId: string,
  restaurantId: string,
  points: number,
  reason: string,
  reservationId?: string,
): Promise<LoyaltyTransactionRow> {
  const guest = await guestRepository.findById(guestId);

  if (!guest || guest.pointsBalance < points) {
    throw new Error(
      `Insufficient points: balance is ${guest?.pointsBalance ?? 0}, tried to deduct ${points}`,
    );
  }

  // Ledger entry + balance debit commit atomically.
  return db.transaction(async (trx) => {
    const tx = await loyaltyTransactionRepository.insert({
      restaurantId,
      guestId,
      type: "redeem",
      points: -points,
      reason,
      reservationId: reservationId ?? null,
    }, trx);

    await guestRepository.adjustPoints(guestId, -points, trx);

    return tx;
  });
}

export async function getPointsBalance(
  guestId: string,
): Promise<{ pointsBalance: number; tier: Tier } | null> {
  const guest = await guestRepository.findById(guestId);

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
  return loyaltyTransactionRepository.findByGuest(guestId, { limit });
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
  const guest = await guestRepository.findById(guestId);

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
  const guest = await guestRepository.findById(guestId);

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
    await guestRepository.updateById(guestId, { tier: newTier, updatedAt: new Date() });
  }

  return { oldTier, newTier, changed };
}

// ── Rewards ────────────────────────────────────────────

export async function listRewards(
  restaurantId: string,
  includeInactive = false,
): Promise<RewardRow[]> {
  return rewardRepository.listByRestaurant(restaurantId, includeInactive);
}

export async function updateReward(
  rewardId: string,
  restaurantId: string,
  data: {
    nameHe?: string;
    nameEn?: string;
    description?: string;
    pointsCost?: number;
    templateKey?: string | null;
    recommendedMoments?: string[] | null;
    pitchHe?: string | null;
    pitchEn?: string | null;
    isActive?: boolean;
  },
): Promise<RewardRow | null> {
  const existing = await rewardRepository.findByIdInRestaurant(rewardId, restaurantId);

  if (!existing) return null;

  return rewardRepository.updateInRestaurant(rewardId, restaurantId, {
    ...(data.nameHe !== undefined ? { nameHe: data.nameHe } : {}),
    ...(data.nameEn !== undefined ? { nameEn: data.nameEn } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.pointsCost !== undefined ? { pointsCost: data.pointsCost } : {}),
    ...(data.templateKey !== undefined ? { templateKey: data.templateKey } : {}),
    ...(data.recommendedMoments !== undefined ? { recommendedMoments: data.recommendedMoments } : {}),
    ...(data.pitchHe !== undefined ? { pitchHe: data.pitchHe } : {}),
    ...(data.pitchEn !== undefined ? { pitchEn: data.pitchEn } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  });
}

export async function createReward(data: {
  restaurantId: string;
  nameHe: string;
  nameEn?: string;
  description?: string;
  pointsCost: number;
  templateKey?: string | null;
  recommendedMoments?: string[] | null;
  pitchHe?: string | null;
  pitchEn?: string | null;
}): Promise<RewardRow> {
  return rewardRepository.insert({
    restaurantId: data.restaurantId,
    nameHe: data.nameHe,
    nameEn: data.nameEn ?? null,
    description: data.description ?? null,
    pointsCost: data.pointsCost,
    templateKey: data.templateKey ?? null,
    recommendedMoments: data.recommendedMoments ?? null,
    pitchHe: data.pitchHe ?? null,
    pitchEn: data.pitchEn ?? null,
  });
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
  const reward = await rewardRepository.findActiveById(rewardId);

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

  const guest = await guestRepository.findById(guestId);

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
  visitPointsAwarded: number;
  stampBonus: boolean;
  luckySpin: LuckySpinResult;
  tierChange: TierEvaluation | null;
}> {
  // Guest visitCount was already incremented before this call
  const guest = await guestRepository.findById(guestId);

  if (!guest) {
    throw new Error("Guest not found");
  }

  const reservation = await reservationRepository.findVisitCompletionContext(
    reservationId,
    restaurantId,
    guestId,
  );

  const tier = (guest.tier ?? "bronze") as Tier;
  const tierMultiplier = getTierMultiplier(tier);
  const offPeakMultiplier = reservation
    ? getConfiguredOffPeakMultiplier(
      reservation.dashboardConfig,
      reservation.date,
      reservation.timeStart,
    )
    : 1;
  const pointsForVisit = Math.round(POINTS_PER_VISIT * tierMultiplier * offPeakMultiplier);

  // Award visit points
  const existingVisitCompletion = await loyaltyTransactionRepository.findEarnByReason(
    guestId,
    restaurantId,
    reservationId,
    "visit_completion",
  );

  if (!existingVisitCompletion) {
    await awardPoints(guestId, restaurantId, pointsForVisit, "visit_completion", reservationId);
  }

  // Check stamp card — every 10th visit gets bonus
  let stampBonus = false;
  let hostGroupBonus = false;
  if (guest.visitCount % STAMP_CARD_SIZE === 0 && guest.visitCount > 0) {
    const existingStampBonus = await loyaltyTransactionRepository.findEarnByReason(
      guestId,
      restaurantId,
      reservationId,
      "stamp_card_bonus",
    );

    if (!existingStampBonus) {
      await awardPoints(guestId, restaurantId, STAMP_BONUS_POINTS, "stamp_card_bonus", reservationId);
      stampBonus = true;
    }
  }

  if (reservation && reservation.partySize >= HOST_GROUP_MIN_PARTY_SIZE) {
    const existingHostGroupBonus = await loyaltyTransactionRepository.findEarnByReason(
      guestId,
      restaurantId,
      reservationId,
      "host_group_bonus",
    );

    if (!existingHostGroupBonus) {
      await awardPoints(
        guestId,
        restaurantId,
        HOST_GROUP_BONUS_POINTS,
        "host_group_bonus",
        reservationId,
      );
      hostGroupBonus = true;
    }
  }

  const luckySpin = await awardLuckySpinForVisit({
    guestId,
    restaurantId,
    reservationId,
    visitCount: guest.visitCount,
    dashboardConfig: reservation?.dashboardConfig,
  });

  // Evaluate tier
  const tierChange = await evaluateTier(guestId);

  return {
    pointsAwarded:
      pointsForVisit
      + (stampBonus ? STAMP_BONUS_POINTS : 0)
      + (hostGroupBonus ? HOST_GROUP_BONUS_POINTS : 0)
      + (!luckySpin.alreadyAwarded ? luckySpin.prize?.points ?? 0 : 0),
    visitPointsAwarded: pointsForVisit,
    stampBonus,
    luckySpin,
    tierChange,
  };
}
