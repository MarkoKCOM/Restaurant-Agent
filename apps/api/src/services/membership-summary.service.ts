import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, loyaltyTransactions, restaurants, rewards } from "../db/schema.js";
import { checkStampCard, getConfiguredLuckySpin } from "./loyalty.service.js";
import { getReferralStats } from "./referral.service.js";
import { getStreak } from "./challenge.service.js";
import { getGuestClaims } from "./reward-claims.service.js";
import { getMenuExplorationFromPreferences } from "./visit.service.js";
import { getAchievementsFromPreferences } from "./achievement.service.js";
import { currentLeaderboardPeriod, getGuestLeaderboardRank, getLeaderboardPreference } from "./leaderboard.service.js";
import { getGuestShareTemplates, type ShareTemplate } from "./gamification-share.service.js";

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
  menuExploration: {
    categoriesTried: string[];
    categoryCount: number;
    badges: Array<{
      key: string;
      nameHe: string;
      nameEn: string;
      unlockedAt: string;
    }>;
  };
  achievements: {
    count: number;
    badges: Array<{
      key: string;
      nameHe: string;
      nameEn: string;
      descriptionHe: string;
      descriptionEn: string;
      unlockedAt: string;
    }>;
  };
  leaderboard: {
    optedIn: boolean;
    optedInAt?: string;
    rank: number | null;
    pointsEarned: number | null;
    period: string | null;
  };
  luckySpin: {
    enabled: boolean;
    triggerEvery: number;
    nextEligibleVisit: number | null;
    lastPrize: {
      key: string;
      points: number;
      awardedAt: Date;
      reservationId: string | null;
    } | null;
  };
  shareTemplates: ShareTemplate[];
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

  const [stampCard, allClaims, referralStats, streak, rewardRows, leaderboardRank, shareTemplateSet, luckySpinRows, restaurantRows] = await Promise.all([
    checkStampCard(guestId),
    getGuestClaims(guestId),
    getReferralStats(guestId),
    getStreak(guestId),
    db
      .select()
      .from(rewards)
      .where(and(eq(rewards.restaurantId, guest.restaurantId), eq(rewards.isActive, true))),
    getGuestLeaderboardRank(guestId, guest.restaurantId),
    getGuestShareTemplates(guestId),
    db
      .select({
        reason: loyaltyTransactions.reason,
        points: loyaltyTransactions.points,
        createdAt: loyaltyTransactions.createdAt,
        reservationId: loyaltyTransactions.reservationId,
      })
      .from(loyaltyTransactions)
      .where(and(
        eq(loyaltyTransactions.guestId, guestId),
        eq(loyaltyTransactions.restaurantId, guest.restaurantId),
        sql`${loyaltyTransactions.reason} like 'lucky_spin:%'`,
      ))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(1),
    db
      .select({ dashboardConfig: restaurants.dashboardConfig })
      .from(restaurants)
      .where(eq(restaurants.id, guest.restaurantId))
      .limit(1),
  ]);
  const leaderboardPreference = getLeaderboardPreference(guest.preferences);
  const luckySpinConfig = getConfiguredLuckySpin(restaurantRows[0]?.dashboardConfig);
  const nextEligibleVisit = luckySpinConfig.enabled
    ? Math.ceil((guest.visitCount + 1) / luckySpinConfig.triggerEvery) * luckySpinConfig.triggerEvery
    : null;
  const lastLuckySpin = luckySpinRows[0];

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
    menuExploration: getMenuExplorationFromPreferences(guest.preferences),
    achievements: getAchievementsFromPreferences(guest.preferences),
    leaderboard: {
      optedIn: leaderboardPreference.optedIn,
      optedInAt: leaderboardPreference.optedInAt,
      rank: leaderboardRank?.rank ?? null,
      pointsEarned: leaderboardRank?.pointsEarned ?? null,
      period: leaderboardRank ? currentLeaderboardPeriod() : null,
    },
    luckySpin: {
      enabled: luckySpinConfig.enabled,
      triggerEvery: luckySpinConfig.triggerEvery,
      nextEligibleVisit,
      lastPrize: lastLuckySpin
        ? {
          key: lastLuckySpin.reason?.replace(/^lucky_spin:/, "") ?? "unknown",
          points: lastLuckySpin.points,
          awardedAt: lastLuckySpin.createdAt,
          reservationId: lastLuckySpin.reservationId,
        }
        : null,
    },
    shareTemplates: shareTemplateSet?.templates ?? [],
    optedOutCampaigns: guest.optedOutCampaigns,
  };
}
