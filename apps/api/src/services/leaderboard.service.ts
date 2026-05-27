import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, loyaltyTransactions } from "../db/schema.js";
import { awardPoints } from "./loyalty.service.js";
import { scheduleLeaderboardSummary } from "./engagement.service.js";

export interface LeaderboardEntry {
  guestId: string;
  guestName: string;
  rank: number;
  pointsEarned: number;
  tier: string;
  visitCount: number;
}

export interface LeaderboardSummary {
  restaurantId: string;
  period: string;
  entries: LeaderboardEntry[];
  participantCount: number;
}

export interface LeaderboardPreference {
  optedIn: boolean;
  optedInAt?: string;
  optedOutAt?: string;
}

const DEFAULT_MONTHLY_REWARDS = [150, 100, 50] as const;

function parseGuestPreferences(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseLeaderboardPreference(preferences: unknown): LeaderboardPreference {
  const prefs = parseGuestPreferences(preferences);
  const raw = prefs.leaderboard;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { optedIn: false };
  }

  const value = raw as Record<string, unknown>;
  return {
    optedIn: value.optedIn === true,
    optedInAt: typeof value.optedInAt === "string" ? value.optedInAt : undefined,
    optedOutAt: typeof value.optedOutAt === "string" ? value.optedOutAt : undefined,
  };
}

function periodBounds(period: string): { start: Date; end: Date } {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error("Leaderboard period must be YYYY-MM");

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Leaderboard period month must be 01-12");

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));
  return { start, end };
}

export function currentLeaderboardPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getLeaderboardPreference(preferences: unknown): LeaderboardPreference {
  return parseLeaderboardPreference(preferences);
}

export async function setLeaderboardOptIn(
  guestId: string,
  optedIn: boolean,
): Promise<LeaderboardPreference | null> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) return null;

  const prefs = parseGuestPreferences(guest.preferences);
  const existing = parseLeaderboardPreference(prefs);
  const now = new Date().toISOString();
  const leaderboard: LeaderboardPreference = optedIn
    ? { optedIn: true, optedInAt: existing.optedInAt ?? now }
    : { optedIn: false, optedInAt: existing.optedInAt, optedOutAt: now };

  await db
    .update(guests)
    .set({
      preferences: {
        ...prefs,
        leaderboard,
      },
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guestId));

  return leaderboard;
}

export async function getLeaderboard(
  restaurantId: string,
  period = currentLeaderboardPeriod(),
  limit = 10,
): Promise<LeaderboardSummary> {
  const { start, end } = periodBounds(period);
  const rows = await db.execute(sql`
    with opted_in as (
      select
        id,
        name,
        tier,
        visit_count
      from ${guests}
      where restaurant_id = ${restaurantId}
        and preferences->'leaderboard'->>'optedIn' = 'true'
    ),
    earned as (
      select
        oi.id,
        oi.name,
        coalesce(oi.tier::text, 'bronze') as tier,
        oi.visit_count,
        coalesce(sum(lt.points) filter (where lt.type = 'earn'), 0)::int as points_earned
      from opted_in oi
      left join ${loyaltyTransactions} lt on lt.guest_id = oi.id
        and lt.restaurant_id = ${restaurantId}
        and lt.created_at >= ${start}
        and lt.created_at < ${end}
      group by oi.id, oi.name, oi.tier, oi.visit_count
    )
    select
      id as guest_id,
      name as guest_name,
      tier,
      visit_count,
      points_earned,
      rank() over (order by points_earned desc, visit_count desc, name asc)::int as rank
    from earned
    order by points_earned desc, visit_count desc, name asc
    limit ${Math.max(1, Math.min(limit, 100))}
  `) as Array<{
    guest_id: string;
    guest_name: string;
    tier: string;
    visit_count: number;
    points_earned: number;
    rank: number;
  }>;

  const participantRows = await db.execute(sql`
    select count(*)::int as participant_count
    from ${guests}
    where restaurant_id = ${restaurantId}
      and preferences->'leaderboard'->>'optedIn' = 'true'
  `) as Array<{ participant_count: number }>;

  return {
    restaurantId,
    period,
    participantCount: Number(participantRows[0]?.participant_count ?? 0),
    entries: rows.map((row) => ({
      guestId: row.guest_id,
      guestName: row.guest_name,
      rank: Number(row.rank),
      pointsEarned: Number(row.points_earned),
      tier: row.tier,
      visitCount: Number(row.visit_count),
    })),
  };
}

export async function getGuestLeaderboardRank(
  guestId: string,
  restaurantId: string,
  period = currentLeaderboardPeriod(),
): Promise<LeaderboardEntry | null> {
  const leaderboard = await getLeaderboard(restaurantId, period, 100);
  return leaderboard.entries.find((entry) => entry.guestId === guestId) ?? null;
}

export async function finalizeMonthlyLeaderboard(params: {
  restaurantId: string;
  period?: string;
  rewards?: number[];
}): Promise<{
  period: string;
  winners: Array<LeaderboardEntry & { rewardPoints: number; alreadyAwarded: boolean; summaryJobId: string | null }>;
}> {
  const period = params.period ?? currentLeaderboardPeriod();
  const rewards = params.rewards?.length ? params.rewards : [...DEFAULT_MONTHLY_REWARDS];
  const leaderboard = await getLeaderboard(params.restaurantId, period, rewards.length);
  const winners = [];

  for (const entry of leaderboard.entries.slice(0, rewards.length)) {
    const rewardPoints = rewards[entry.rank - 1] ?? 0;
    const reason = `leaderboard_monthly:${period}:rank:${entry.rank}`;
    const [existingReward] = await db
      .select({ id: loyaltyTransactions.id })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.restaurantId, params.restaurantId),
          eq(loyaltyTransactions.guestId, entry.guestId),
          eq(loyaltyTransactions.type, "earn"),
          eq(loyaltyTransactions.reason, reason),
        ),
      )
      .limit(1);

    if (!existingReward && rewardPoints > 0) {
      await awardPoints(entry.guestId, params.restaurantId, rewardPoints, reason);
    }

    const summaryJob = await scheduleLeaderboardSummary(entry.guestId, params.restaurantId, period);
    winners.push({
      ...entry,
      rewardPoints,
      alreadyAwarded: Boolean(existingReward),
      summaryJobId: summaryJob.id,
    });
  }

  return { period, winners };
}
