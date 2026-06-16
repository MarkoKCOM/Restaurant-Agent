import { awardPoints } from "./loyalty.service.js";
import { scheduleChallengeCompletion, scheduleStreakBrokenRecovery } from "./engagement.service.js";
import { challengeRepository } from "../repositories/challenge.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { loyaltyTransactionRepository } from "../repositories/loyalty-transaction.repository.js";

export type { ChallengeRow, ChallengeProgressRow } from "../repositories/challenge.repository.js";
import type { ChallengeRow, ChallengeProgressRow } from "../repositories/challenge.repository.js";

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
  return challengeRepository.insert({
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
  });
}

export async function listActiveChallenges(
  restaurantId: string,
): Promise<ChallengeRow[]> {
  const today = formatJerusalemDate(new Date());

  return challengeRepository.listActive(restaurantId, today);
}

export async function getChallengeById(challengeId: string): Promise<ChallengeRow | null> {
  return challengeRepository.findById(challengeId);
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
  const existing = await challengeRepository.findByIdInRestaurant(challengeId, restaurantId);

  if (!existing) return null;
  if (Object.keys(data).length === 0) return existing;

  return challengeRepository.updateInRestaurant(challengeId, restaurantId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.type !== undefined ? { type: data.type } : {}),
    ...(data.target !== undefined ? { targetValue: data.target } : {}),
    ...(data.reward !== undefined ? { rewardPoints: data.reward } : {}),
    ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
    ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
    ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  });
}

export async function getGuestChallengeProgress(
  guestId: string,
  challengeId: string,
): Promise<ChallengeProgressRow | null> {
  return challengeRepository.findProgress(guestId, challengeId);
}

export async function incrementChallengeProgress(
  guestId: string,
  challengeId: string,
): Promise<{
  completed: boolean;
  reward: number;
  progress: number;
  target: number;
  completionJobId: string | null;
}> {
  // Get the challenge
  const challenge = await challengeRepository.findById(challengeId);

  if (!challenge) {
    throw new Error("Challenge not found");
  }

  // Get or create progress record
  let progress = await getGuestChallengeProgress(guestId, challengeId);

  if (!progress) {
    progress = await challengeRepository.insertProgress({
      challengeId,
      guestId,
      currentValue: 0,
      status: "in_progress",
    });
  }

  // Already completed
  if (progress.completedAt) {
    return {
      completed: true,
      reward: challenge.rewardPoints,
      progress: progress.currentValue,
      target: challenge.targetValue,
      completionJobId: null,
    };
  }

  // Increment progress
  const newValue = progress.currentValue + 1;
  const completed = newValue >= challenge.targetValue;

  await challengeRepository.updateProgressById(progress.id, {
    currentValue: newValue,
    status: completed ? "completed" : "in_progress",
    completedAt: completed ? new Date() : null,
  });

  // Award points on completion
  let completionJobId: string | null = null;
  if (completed) {
    // Get guest to find restaurantId
    const guest = await guestRepository.findById(guestId);

    if (guest) {
      await awardPoints(
        guestId,
        guest.restaurantId,
        challenge.rewardPoints,
        `challenge_completed:${challenge.name}`,
      );
      const completionJob = await scheduleChallengeCompletion(guestId, guest.restaurantId);
      completionJobId = completionJob.id;
    }
  }

  return {
    completed,
    reward: challenge.rewardPoints,
    progress: newValue,
    target: challenge.targetValue,
    completionJobId,
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
  const today = formatJerusalemDate(new Date());
  const activeChallenges = await challengeRepository.listActiveByTypes(
    restaurantId,
    today,
    ["visit_count", "birthday_week"],
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
  targetGuestId?: string;
  createdChallengeSamples: Array<{ guestId: string; challengeId: string }>;
  skippedExistingSamples: Array<{ guestId: string; challengeId: string }>;
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
  return challengeRepository.findBirthdayWeek(
    params.restaurantId,
    params.guestId,
    params.occurrenceYear,
  );
}

export async function checkBirthdayWeekChallenges(
  restaurantId: string,
  options: { guestId?: string } = {},
): Promise<BirthdayWeekChallengeResult> {
  const result: BirthdayWeekChallengeResult = {
    due: 0,
    created: 0,
    skippedExisting: 0,
    skippedInvalidBirthday: 0,
    ...(options.guestId ? { targetGuestId: options.guestId } : {}),
    createdChallengeSamples: [],
    skippedExistingSamples: [],
  };

  let restaurantGuests;
  if (options.guestId) {
    const targetGuest = await guestRepository.findById(options.guestId);
    restaurantGuests = targetGuest && targetGuest.restaurantId === restaurantId ? [targetGuest] : [];
  } else {
    restaurantGuests = await guestRepository.listByRestaurant(restaurantId);
  }

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
      if (result.skippedExistingSamples.length < 5) {
        result.skippedExistingSamples.push({ guestId: guest.id, challengeId: existing.id });
      }
      continue;
    }

    const startDate = new Date(occurrence.occurrenceDate);
    startDate.setDate(startDate.getDate() - 7);
    const created = await createChallenge({
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
    if (result.createdChallengeSamples.length < 5) {
      result.createdChallengeSamples.push({ guestId: guest.id, challengeId: created.id });
    }
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
  const guest = await guestRepository.findById(guestId);

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

  await guestRepository.updateById(guestId, {
    preferences: prefs,
    updatedAt: new Date(),
  });

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
  const transaction = await loyaltyTransactionRepository.findEarnByReason(
    params.guestId,
    params.restaurantId,
    params.reservationId,
    "visit_completion",
  );

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
  const existingBonus = await loyaltyTransactionRepository.findEarnByReasonForGuest(
    params.guestId,
    params.restaurantId,
    reason,
  );

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
  const guest = await guestRepository.findById(guestId);

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
