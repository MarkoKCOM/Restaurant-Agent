import { and, eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  challenges,
  challengeProgress,
  guests,
  loyaltyTransactions,
} from "../db/schema.js";
import { awardPoints } from "./loyalty.service.js";
import { scheduleStreakBrokenRecovery } from "./engagement.service.js";

export type ChallengeRow = InferSelectModel<typeof challenges>;
export type ChallengeProgressRow = InferSelectModel<typeof challengeProgress>;

// ── Streak helpers ────────────────────────────────────────

interface StreakData {
  current: number;
  best: number;
  lastVisitWeek: string;
}

interface StreakUpdateOptions {
  reservationId?: string;
  visitPointsAwarded?: number;
}

interface StreakUpdateResult extends StreakData {
  broken: boolean;
  milestoneReached: number | null;
  bonusPointsAwarded: number;
  recoveryJobId: string | null;
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function parsePreferences(prefs: unknown): Record<string, unknown> {
  if (prefs && typeof prefs === "object" && !Array.isArray(prefs)) {
    return prefs as Record<string, unknown>;
  }
  return {};
}

function getStreakFromPrefs(prefs: unknown): StreakData {
  const parsed = parsePreferences(prefs);
  const streak = parsed.streak as Partial<StreakData> | undefined;
  return {
    current: streak?.current ?? 0,
    best: streak?.best ?? 0,
    lastVisitWeek: streak?.lastVisitWeek ?? "",
  };
}

const STREAK_MILESTONES = [3, 5, 10, 20];

// ── Challenge CRUD ────────────────────────────────────────

export interface CreateChallengeInput {
  restaurantId: string;
  name: string;
  description?: string;
  type: string; // "visit_count" | "spend_count" | "streak" | "custom"
  target: number;
  reward: number; // points
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
}

export async function createChallenge(
  data: CreateChallengeInput,
): Promise<ChallengeRow> {
  const [created] = await db
    .insert(challenges)
    .values({
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      targetValue: data.target,
      rewardPoints: data.reward,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      metadata: data.metadata ?? null,
      isActive: true,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create challenge");
  }

  return created;
}

export async function listActiveChallenges(
  restaurantId: string,
): Promise<ChallengeRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  return db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.restaurantId, restaurantId),
        eq(challenges.isActive, true),
        // Date bounds are optional. When present, the challenge is active only inside the launch window.
        sql`(${challenges.startDate} IS NULL OR ${challenges.startDate} <= ${today})`,
        sql`(${challenges.endDate} IS NULL OR ${challenges.endDate} >= ${today})`,
      ),
    );
}

export async function getChallengeById(challengeId: string): Promise<ChallengeRow | null> {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  return challenge ?? null;
}

export async function updateChallenge(
  challengeId: string,
  restaurantId: string,
  data: {
    name?: string;
    description?: string | null;
    type?: string;
    target?: number;
    reward?: number;
    startDate?: string | null;
    endDate?: string | null;
    metadata?: Record<string, unknown> | null;
    isActive?: boolean;
  },
): Promise<ChallengeRow | null> {
  const [existing] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.restaurantId, restaurantId)))
    .limit(1);

  if (!existing) return null;
  if (Object.keys(data).length === 0) return existing;

  const [updated] = await db
    .update(challenges)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.target !== undefined ? { targetValue: data.target } : {}),
      ...(data.reward !== undefined ? { rewardPoints: data.reward } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    })
    .where(and(eq(challenges.id, challengeId), eq(challenges.restaurantId, restaurantId)))
    .returning();

  return updated ?? null;
}

export async function getGuestChallengeProgress(
  guestId: string,
  challengeId: string,
): Promise<ChallengeProgressRow | null> {
  const [row] = await db
    .select()
    .from(challengeProgress)
    .where(
      and(
        eq(challengeProgress.guestId, guestId),
        eq(challengeProgress.challengeId, challengeId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function incrementChallengeProgress(
  guestId: string,
  challengeId: string,
): Promise<{ completed: boolean; reward: number; progress: number; target: number }> {
  // Get the challenge
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  if (!challenge) {
    throw new Error("Challenge not found");
  }

  // Get or create progress record
  let progress = await getGuestChallengeProgress(guestId, challengeId);

  if (!progress) {
    const [created] = await db
      .insert(challengeProgress)
      .values({
        challengeId,
        guestId,
        currentValue: 0,
        status: "in_progress",
      })
      .returning();

    progress = created!;
  }

  // Already completed
  if (progress.completedAt) {
    return {
      completed: true,
      reward: challenge.rewardPoints,
      progress: progress.currentValue,
      target: challenge.targetValue,
    };
  }

  // Increment progress
  const newValue = progress.currentValue + 1;
  const completed = newValue >= challenge.targetValue;

  const [updated] = await db
    .update(challengeProgress)
    .set({
      currentValue: newValue,
      status: completed ? "completed" : "in_progress",
      completedAt: completed ? new Date() : null,
    })
    .where(eq(challengeProgress.id, progress.id))
    .returning();

  // Award points on completion
  if (completed) {
    // Get guest to find restaurantId
    const [guest] = await db
      .select()
      .from(guests)
      .where(eq(guests.id, guestId))
      .limit(1);

    if (guest) {
      await awardPoints(
        guestId,
        guest.restaurantId,
        challenge.rewardPoints,
        `challenge_completed:${challenge.name}`,
      );
    }
  }

  return {
    completed,
    reward: challenge.rewardPoints,
    progress: newValue,
    target: challenge.targetValue,
  };
}

export async function getGuestActiveChallenges(
  guestId: string,
  restaurantId: string,
): Promise<
  Array<{
    challenge: ChallengeRow;
    progress: ChallengeProgressRow | null;
  }>
> {
  const activeChallenges = await listActiveChallenges(restaurantId);

  const results = await Promise.all(
    activeChallenges.filter((challenge) => isChallengeVisibleToGuest(challenge, guestId)).map(async (challenge) => {
      const progress = await getGuestChallengeProgress(guestId, challenge.id);
      return { challenge, progress };
    }),
  );

  return results;
}

export async function autoProgressVisitCountChallenges(
  guestId: string,
  restaurantId: string,
): Promise<Array<{ challengeId: string; completed: boolean; progress: number; target: number }>> {
  const today = new Date().toISOString().slice(0, 10);
  const activeChallenges = await db
    .select({ id: challenges.id, type: challenges.type, metadata: challenges.metadata })
    .from(challenges)
    .where(
      and(
        eq(challenges.restaurantId, restaurantId),
        eq(challenges.isActive, true),
        sql`${challenges.type} in ('visit_count', 'birthday_week')`,
        sql`(${challenges.startDate} IS NULL OR ${challenges.startDate} <= ${today})`,
        sql`(${challenges.endDate} IS NULL OR ${challenges.endDate} >= ${today})`,
      ),
    );

  const results: Array<{ challengeId: string; completed: boolean; progress: number; target: number }> = [];

  for (const challenge of activeChallenges) {
    if (challenge.type === "birthday_week" && getMetadataGuestId(challenge.metadata) !== guestId) {
      continue;
    }
    const result = await incrementChallengeProgress(guestId, challenge.id);
    results.push({
      challengeId: challenge.id,
      completed: result.completed,
      progress: result.progress,
      target: result.target,
    });
  }

  return results;
}

interface BirthdayWeekChallengeResult {
  due: number;
  created: number;
  skippedExisting: number;
  skippedInvalidBirthday: number;
}

function getMetadataGuestId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).guestId;
  return typeof value === "string" ? value : null;
}

function isChallengeVisibleToGuest(challenge: ChallengeRow, guestId: string): boolean {
  if (challenge.type !== "birthday_week") return true;
  return getMetadataGuestId(challenge.metadata) === guestId;
}

function getBirthdayMonthDay(birthday: unknown): string | null {
  if (typeof birthday !== "string") return null;
  const normalized = birthday.trim();
  if (/^\d{2}-\d{2}$/.test(normalized)) return normalized;
  const isoDate = normalized.match(/^\d{4}-(\d{2}-\d{2})$/);
  return isoDate?.[1] ?? null;
}

function getJerusalemDateParts(date = new Date()): { year: number; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };
}

function formatJerusalemDate(date: Date): string {
  const { year, month, day } = getJerusalemDateParts(date);
  return `${year}-${month}-${day}`;
}

function getUpcomingBirthdayOccurrence(monthDay: string, referenceDate = new Date()): { occurrenceDate: Date; occurrenceYear: number; daysUntil: number } | null {
  const [month, day] = monthDay.split("-");
  if (!month || !day) return null;

  const { year } = getJerusalemDateParts(referenceDate);
  const todayDate = new Date(`${formatJerusalemDate(referenceDate)}T00:00:00+03:00`);
  const candidates = [
    new Date(`${year}-${month}-${day}T00:00:00+03:00`),
    new Date(`${year + 1}-${month}-${day}T00:00:00+03:00`),
  ];

  for (const occurrenceDate of candidates) {
    if (Number.isNaN(occurrenceDate.getTime())) continue;
    const daysUntil = Math.round((occurrenceDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysUntil >= 0 && daysUntil <= 7) {
      return { occurrenceDate, occurrenceYear: Number(formatJerusalemDate(occurrenceDate).slice(0, 4)), daysUntil };
    }
  }

  return null;
}

async function findBirthdayWeekChallenge(params: {
  restaurantId: string;
  guestId: string;
  occurrenceYear: number;
}): Promise<ChallengeRow | null> {
  const [existing] = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.restaurantId, params.restaurantId),
        eq(challenges.type, "birthday_week"),
        sql`${challenges.metadata} ->> 'source' = 'birthday_week'`,
        sql`${challenges.metadata} ->> 'guestId' = ${params.guestId}`,
        sql`(${challenges.metadata} ->> 'occurrenceYear')::int = ${params.occurrenceYear}`,
      ),
    )
    .limit(1);

  return existing ?? null;
}

export async function checkBirthdayWeekChallenges(
  restaurantId: string,
): Promise<BirthdayWeekChallengeResult> {
  const result: BirthdayWeekChallengeResult = {
    due: 0,
    created: 0,
    skippedExisting: 0,
    skippedInvalidBirthday: 0,
  };

  const restaurantGuests = await db
    .select()
    .from(guests)
    .where(eq(guests.restaurantId, restaurantId));

  for (const guest of restaurantGuests) {
    const prefs = parsePreferences(guest.preferences);
    if (!("birthday" in prefs)) continue;

    const monthDay = getBirthdayMonthDay(prefs.birthday);
    if (!monthDay) {
      result.skippedInvalidBirthday++;
      continue;
    }

    const occurrence = getUpcomingBirthdayOccurrence(monthDay);
    if (!occurrence) continue;

    result.due++;
    const existing = await findBirthdayWeekChallenge({
      restaurantId,
      guestId: guest.id,
      occurrenceYear: occurrence.occurrenceYear,
    });
    if (existing) {
      result.skippedExisting++;
      continue;
    }

    const startDate = new Date(occurrence.occurrenceDate);
    startDate.setDate(startDate.getDate() - 7);
    await createChallenge({
      restaurantId,
      name: `Birthday week challenge: ${guest.name}`,
      description: "A private birthday-week visit challenge with bonus points for celebrating at the restaurant.",
      type: "birthday_week",
      target: 1,
      reward: 50,
      startDate: formatJerusalemDate(startDate),
      endDate: formatJerusalemDate(occurrence.occurrenceDate),
      metadata: {
        source: "birthday_week",
        guestId: guest.id,
        birthdayMonthDay: monthDay,
        occurrenceYear: occurrence.occurrenceYear,
      },
    });
    result.created++;
  }

  return result;
}

// ── Streak tracking ───────────────────────────────────────

/**
 * Update streak for a guest on visit completion.
 * Should be called when a reservation status changes to 'completed'.
 */
export async function updateStreak(
  guestId: string,
  restaurantId: string,
  options: StreakUpdateOptions = {},
): Promise<StreakUpdateResult> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) {
    throw new Error("Guest not found");
  }

  const now = new Date();
  const currentWeek = getISOWeek(now);
  const streakData = getStreakFromPrefs(guest.preferences);

  if (streakData.lastVisitWeek === currentWeek) {
    const bonusPointsAwarded = await maybeAwardStreakMilestoneBonus({
      guestId,
      restaurantId,
      milestone: streakData.current,
      reservationId: options.reservationId,
      visitPointsAwarded: options.visitPointsAwarded,
    });
    return {
      ...streakData,
      broken: false,
      milestoneReached: STREAK_MILESTONES.includes(streakData.current) ? streakData.current : null,
      bonusPointsAwarded,
      recoveryJobId: null,
    };
  }

  let newCurrent: number;
  let broken = false;

  if (streakData.lastVisitWeek === "") {
    newCurrent = 1;
  } else {
    const weekGap = weekDifference(streakData.lastVisitWeek, currentWeek);
    if (weekGap === 1) {
      newCurrent = streakData.current + 1;
    } else {
      newCurrent = 1;
      broken = streakData.current >= 3;
    }
  }

  const newBest = Math.max(streakData.best, newCurrent);

  const newStreak: StreakData = {
    current: newCurrent,
    best: newBest,
    lastVisitWeek: currentWeek,
  };

  // Update guest preferences with streak data
  const prefs = parsePreferences(guest.preferences);
  prefs.streak = newStreak;

  await db
    .update(guests)
    .set({
      preferences: prefs,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guestId));

  const milestoneReached = STREAK_MILESTONES.includes(newCurrent) ? newCurrent : null;
  const bonusPointsAwarded = await maybeAwardStreakMilestoneBonus({
    guestId,
    restaurantId,
    milestone: newCurrent,
    reservationId: options.reservationId,
    visitPointsAwarded: options.visitPointsAwarded,
  });
  const recoveryJob = broken
    ? await scheduleStreakBrokenRecovery(guestId, restaurantId)
    : null;

  return {
    ...newStreak,
    broken,
    milestoneReached,
    bonusPointsAwarded,
    recoveryJobId: recoveryJob?.id ?? null,
  };
}

async function getVisitCompletionPoints(params: {
  guestId: string;
  restaurantId: string;
  reservationId: string;
}): Promise<number | null> {
  const [transaction] = await db
    .select({ points: loyaltyTransactions.points })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.guestId, params.guestId),
        eq(loyaltyTransactions.restaurantId, params.restaurantId),
        eq(loyaltyTransactions.reservationId, params.reservationId),
        eq(loyaltyTransactions.type, "earn"),
        eq(loyaltyTransactions.reason, "visit_completion"),
      ),
    )
    .limit(1);

  return transaction?.points ?? null;
}

async function maybeAwardStreakMilestoneBonus(params: {
  guestId: string;
  restaurantId: string;
  milestone: number;
  reservationId?: string;
  visitPointsAwarded?: number;
}): Promise<number> {
  if (!STREAK_MILESTONES.includes(params.milestone)) return 0;

  const reason = `streak_milestone:${params.milestone}`;
  const duplicateConditions = [
    eq(loyaltyTransactions.guestId, params.guestId),
    eq(loyaltyTransactions.restaurantId, params.restaurantId),
    eq(loyaltyTransactions.type, "earn"),
    eq(loyaltyTransactions.reason, reason),
  ];

  const [existingBonus] = await db
    .select({ points: loyaltyTransactions.points })
    .from(loyaltyTransactions)
    .where(and(...duplicateConditions))
    .limit(1);

  if (existingBonus) return 0;

  const visitPoints = params.visitPointsAwarded
    ?? (params.reservationId
      ? await getVisitCompletionPoints({
        guestId: params.guestId,
        restaurantId: params.restaurantId,
        reservationId: params.reservationId,
      })
      : null);
  const bonusPoints = visitPoints && visitPoints > 0 ? visitPoints : params.milestone * 10;

  await awardPoints(
    params.guestId,
    params.restaurantId,
    bonusPoints,
    reason,
    params.reservationId,
  );

  return bonusPoints;
}

/**
 * Get current streak info for a guest.
 */
export async function getStreak(
  guestId: string,
): Promise<StreakData> {
  const [guest] = await db
    .select({ preferences: guests.preferences })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) {
    throw new Error("Guest not found");
  }

  return getStreakFromPrefs(guest.preferences);
}

/**
 * Convert an ISO week string (e.g., "2026-W14") to a Date (Monday of that week).
 */
function weekToDate(isoWeek: string): Date {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date(0);

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=Mon, 7=Sun
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);

  return targetMonday;
}

function weekDifference(previousWeek: string, currentWeek: string): number {
  const previousDate = weekToDate(previousWeek);
  const currentDate = weekToDate(currentWeek);
  if (previousDate.getTime() === 0 || currentDate.getTime() === 0) return Number.POSITIVE_INFINITY;

  return Math.round((currentDate.getTime() - previousDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
}
