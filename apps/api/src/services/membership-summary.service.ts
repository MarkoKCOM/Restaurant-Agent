import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, rewards } from "../db/schema.js";
import { checkStampCard } from "./loyalty.service.js";
import { getReferralStats } from "./referral.service.js";
import { getStreak } from "./challenge.service.js";
import { getGuestClaims } from "./reward-claims.service.js";

export interface MembershipSummary {
  guestId: string;
  restaurantId: string;
  loyalty: {
    pointsBalance: number;
    tier: string;
    visitCount: number;
    noShowCount: number;
    stampCard: {
      visits: number;
      stampsNeeded: number;
      stampsUntilReward: number;
      earned: number;
    } | null;
  };
  rewards: {
    available: Array<{
      id: string;
      nameHe: string;
      nameEn: string | null | undefined;
      pointsCost: number;
      claimable: boolean;
      pointsShortfall: number;
      templateKey: string | null;
      recommendedMoments: string[] | null;
      pitchHe: string | null;
      pitchEn: string | null;
    }>;
  };
  claims: {
    active: Array<{
      id: string;
      rewardName: string;
      claimCode: string;
      claimedAt: Date;
    }>;
    past: Array<{
      id: string;
      rewardName: string;
      claimCode: string;
      status: string;
      claimedAt: Date;
      redeemedAt: Date | null;
    }>;
  };
  referrals: {
    referralCode: string | null;
    referredBy: string | null;
    referralCount: number;
    totalReferralPoints: number;
  };
  streak: {
    current: number;
    best: number;
    lastVisitWeek: string;
  };
  optedOutCampaigns: boolean;
}

export async function getMembershipSummary(
  guestId: string,
): Promise<MembershipSummary | null> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) return null;

  const [stampCard, allClaims, referralStats, streak, rewardRows] = await Promise.all([
    checkStampCard(guestId),
    getGuestClaims(guestId),
    getReferralStats(guestId),
    getStreak(guestId),
    db
      .select()
      .from(rewards)
      .where(and(eq(rewards.restaurantId, guest.restaurantId), eq(rewards.isActive, true))),
  ]);

  const rewardsWithClaimability = rewardRows.map((r) => ({
    id: r.id,
    nameHe: r.nameHe,
    nameEn: r.nameEn,
    pointsCost: r.pointsCost,
    claimable: guest.pointsBalance >= r.pointsCost,
    pointsShortfall: Math.max(0, r.pointsCost - guest.pointsBalance),
    templateKey: r.templateKey ?? null,
    recommendedMoments: r.recommendedMoments ?? null,
    pitchHe: r.pitchHe ?? null,
    pitchEn: r.pitchEn ?? null,
  }));

  const activeClaims = allClaims
    .filter((c) => c.status === "active")
    .map((c) => ({
      id: c.id,
      rewardName: c.rewardName,
      claimCode: c.claimCode,
      claimedAt: c.claimedAt,
    }));

  const pastClaims = allClaims
    .filter((c) => c.status !== "active")
    .map((c) => ({
      id: c.id,
      rewardName: c.rewardName,
      claimCode: c.claimCode,
      status: c.status,
      claimedAt: c.claimedAt,
      redeemedAt: c.redeemedAt,
    }));

  return {
    guestId,
    restaurantId: guest.restaurantId,
    loyalty: {
      pointsBalance: guest.pointsBalance,
      tier: guest.tier ?? "bronze",
      visitCount: guest.visitCount,
      noShowCount: guest.noShowCount,
      stampCard,
    },
    rewards: {
      available: rewardsWithClaimability,
    },
    claims: {
      active: activeClaims,
      past: pastClaims,
    },
    referrals: {
      referralCode: guest.referralCode,
      referredBy: guest.referredBy,
      referralCount: referralStats.referralCount,
      totalReferralPoints: referralStats.totalPointsEarned,
    },
    streak,
    optedOutCampaigns: guest.optedOutCampaigns,
  };
}
