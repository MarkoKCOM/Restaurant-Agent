import { and, eq, gte, inArray, lt, lte, gt, sql, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { engagementJobs, guests, restaurants, visitLogs } from "../db/schema.js";
import { engagementQueue } from "../queue/index.js";
import type { InferSelectModel } from "drizzle-orm";

export type EngagementJobRow = InferSelectModel<typeof engagementJobs>;
export type EngagementMessageCategory = "transactional" | "promotional";
export type EngagementJobType =
  | "thank_you"
  | "review_request"
  | "birthday"
  | "anniversary"
  | "win_back_30"
  | "win_back_60"
  | "win_back_90"
  | "leaderboard_summary"
  | "lucky_spin_reward";

export const PROMOTIONAL_ENGAGEMENT_TYPES = [
  "review_request",
  "birthday",
  "anniversary",
  "win_back_30",
  "win_back_60",
  "win_back_90",
  "leaderboard_summary",
  "lucky_spin_reward",
] as const;

const PROMOTIONAL_WEEKLY_LIMIT = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const THANK_YOU_DELAY_MS = 2 * 60 * 60 * 1000;
const FIRST_TIME_REVIEW_DELAY_MS = 24 * 60 * 60 * 1000;
const REGULAR_REVIEW_DELAY_MS = 2 * 60 * 60 * 1000;
const DEFAULT_QUIET_HOURS = {
  enabled: true,
  start: "22:00",
  end: "09:00",
};

export interface EngagementQuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export function getEngagementMessageCategory(type: string): EngagementMessageCategory {
  return PROMOTIONAL_ENGAGEMENT_TYPES.includes(type as typeof PROMOTIONAL_ENGAGEMENT_TYPES[number])
    ? "promotional"
    : "transactional";
}

function parseHHMM(value: string): number | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getZonedDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = zoneName.match(/^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/);
  if (!match?.groups?.sign) return 0;

  const sign = match.groups.sign === "-" ? -1 : 1;
  return sign * (Number(match.groups.hours) * 60 + Number(match.groups.minutes ?? 0));
}

function dateForZonedTime(parts: { year: number; month: number; day: number }, time: string, timeZone: string): Date | null {
  const minutes = parseHHMM(time);
  if (minutes === null) return null;

  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, Math.floor(minutes / 60), minutes % 60));
  const offset = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offset * 60 * 1000);
  const correctedOffset = getTimeZoneOffsetMinutes(firstPass, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset * 60 * 1000);
}

function addLocalDays(parts: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getConfiguredQuietHours(dashboardConfig: unknown): EngagementQuietHours {
  const engagementConfig = typeof dashboardConfig === "object" && dashboardConfig !== null
    ? (dashboardConfig as { engagement?: { quietHours?: unknown } }).engagement
    : undefined;
  const quietHours = typeof engagementConfig?.quietHours === "object" && engagementConfig.quietHours !== null
    ? engagementConfig.quietHours as { enabled?: unknown; start?: unknown; end?: unknown }
    : undefined;

  const start = typeof quietHours?.start === "string" && parseHHMM(quietHours.start) !== null
    ? quietHours.start
    : DEFAULT_QUIET_HOURS.start;
  const end = typeof quietHours?.end === "string" && parseHHMM(quietHours.end) !== null
    ? quietHours.end
    : DEFAULT_QUIET_HOURS.end;

  return {
    enabled: typeof quietHours?.enabled === "boolean" ? quietHours.enabled : DEFAULT_QUIET_HOURS.enabled,
    start,
    end,
  };
}

export function isDateInEngagementQuietHours(date: Date, timeZone: string, quietHours: EngagementQuietHours): boolean {
  if (!quietHours.enabled) return false;

  const start = parseHHMM(quietHours.start);
  const end = parseHHMM(quietHours.end);
  if (start === null || end === null || start === end) return false;

  const local = getZonedDateParts(date, timeZone);
  const localMinutes = local.hour * 60 + local.minute;
  return start < end
    ? localMinutes >= start && localMinutes < end
    : localMinutes >= start || localMinutes < end;
}

export function applyEngagementQuietHours(triggerAt: Date, timeZone: string, quietHours: EngagementQuietHours): Date {
  if (!isDateInEngagementQuietHours(triggerAt, timeZone, quietHours)) return triggerAt;

  const start = parseHHMM(quietHours.start);
  const end = parseHHMM(quietHours.end);
  if (start === null || end === null || start === end) return triggerAt;

  const local = getZonedDateParts(triggerAt, timeZone);
  const localMinutes = local.hour * 60 + local.minute;
  const quietEndsTomorrow = start > end && localMinutes >= start;
  return dateForZonedTime(addLocalDays(local, quietEndsTomorrow ? 1 : 0), quietHours.end, timeZone) ?? triggerAt;
}

export async function getRestaurantEngagementQuietHours(restaurantId: string): Promise<{
  timeZone: string;
  quietHours: EngagementQuietHours;
}> {
  const [restaurant] = await db
    .select({
      timezone: restaurants.timezone,
      dashboardConfig: restaurants.dashboardConfig,
    })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  return {
    timeZone: restaurant?.timezone ?? "Asia/Jerusalem",
    quietHours: getConfiguredQuietHours(restaurant?.dashboardConfig),
  };
}

async function applyRestaurantQuietHours(restaurantId: string, triggerAt: Date): Promise<Date> {
  const { timeZone, quietHours } = await getRestaurantEngagementQuietHours(restaurantId);
  return applyEngagementQuietHours(triggerAt, timeZone, quietHours);
}

async function findPendingEngagementJob(params: {
  guestId: string;
  restaurantId: string;
  type: string;
}): Promise<EngagementJobRow | undefined> {
  const [existingJob] = await db
    .select()
    .from(engagementJobs)
    .where(
      and(
        eq(engagementJobs.guestId, params.guestId),
        eq(engagementJobs.restaurantId, params.restaurantId),
        eq(engagementJobs.type, params.type),
        eq(engagementJobs.status, "pending"),
      ),
    )
    .limit(1);

  return existingJob;
}

async function findAnyEngagementJob(params: {
  guestId: string;
  restaurantId: string;
  type: string;
}): Promise<EngagementJobRow | undefined> {
  const [existingJob] = await db
    .select()
    .from(engagementJobs)
    .where(
      and(
        eq(engagementJobs.guestId, params.guestId),
        eq(engagementJobs.restaurantId, params.restaurantId),
        eq(engagementJobs.type, params.type),
      ),
    )
    .limit(1);

  return existingJob;
}

async function findEngagementJobInWindow(params: {
  guestId: string;
  restaurantId: string;
  type: string;
  windowStart: Date;
  windowEnd: Date;
}): Promise<EngagementJobRow | undefined> {
  const [existingJob] = await db
    .select()
    .from(engagementJobs)
    .where(
      and(
        eq(engagementJobs.guestId, params.guestId),
        eq(engagementJobs.restaurantId, params.restaurantId),
        eq(engagementJobs.type, params.type),
        gte(engagementJobs.triggerAt, params.windowStart),
        lt(engagementJobs.triggerAt, params.windowEnd),
      ),
    )
    .limit(1);

  return existingJob;
}

async function getGuestOptOutState(guestId: string): Promise<boolean | null> {
  const [guest] = await db
    .select({ optedOutCampaigns: guests.optedOutCampaigns })
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  return guest?.optedOutCampaigns ?? null;
}

async function countPromotionalJobsInWindow(params: {
  guestId: string;
  restaurantId: string;
  windowStart: Date;
  windowEnd: Date;
  excludeJobId?: string;
}): Promise<number> {
  const conditions = [
    eq(engagementJobs.guestId, params.guestId),
    eq(engagementJobs.restaurantId, params.restaurantId),
    eq(engagementJobs.messageCategory, "promotional"),
    inArray(engagementJobs.status, ["pending", "sent"]),
    gte(engagementJobs.triggerAt, params.windowStart),
    lt(engagementJobs.triggerAt, params.windowEnd),
  ];

  if (params.excludeJobId) {
    conditions.push(ne(engagementJobs.id, params.excludeJobId));
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engagementJobs)
    .where(and(...conditions));

  return result?.count ?? 0;
}

async function evaluatePromotionalEligibility(params: {
  guestId: string;
  restaurantId: string;
  triggerAt: Date;
  excludeJobId?: string;
}): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const optedOutCampaigns = await getGuestOptOutState(params.guestId);
  if (optedOutCampaigns === null) {
    return { allowed: false, reason: "guest_not_found" };
  }
  if (optedOutCampaigns) {
    return { allowed: false, reason: "guest_opted_out_promotional" };
  }

  const sentOrPendingCount = await countPromotionalJobsInWindow({
    guestId: params.guestId,
    restaurantId: params.restaurantId,
    windowStart: new Date(params.triggerAt.getTime() - WEEK_MS),
    windowEnd: new Date(params.triggerAt.getTime() + WEEK_MS),
    excludeJobId: params.excludeJobId,
  });

  if (sentOrPendingCount >= PROMOTIONAL_WEEKLY_LIMIT) {
    return { allowed: false, reason: "promotional_weekly_limit_reached" };
  }

  return { allowed: true };
}

async function createSkippedEngagementJob(params: {
  guestId: string;
  restaurantId: string;
  type: EngagementJobType;
  triggerAt: Date;
  skipReason: string;
}): Promise<EngagementJobRow> {
  const [job] = await db
    .insert(engagementJobs)
    .values({
      restaurantId: params.restaurantId,
      guestId: params.guestId,
      type: params.type,
      messageCategory: getEngagementMessageCategory(params.type),
      triggerAt: params.triggerAt,
      status: "skipped",
      skipReason: params.skipReason,
    })
    .returning();

  if (!job) throw new Error("Failed to create skipped engagement job");
  return job;
}

async function skipPendingEngagementJobs(params: {
  guestId: string;
  restaurantId: string;
  type: EngagementJobType;
  reason: string;
}): Promise<number> {
  const skipped = await db
    .update(engagementJobs)
    .set({
      status: "skipped",
      skipReason: params.reason,
    })
    .where(
      and(
        eq(engagementJobs.guestId, params.guestId),
        eq(engagementJobs.restaurantId, params.restaurantId),
        eq(engagementJobs.type, params.type),
        eq(engagementJobs.status, "pending"),
      ),
    )
    .returning({ id: engagementJobs.id });

  return skipped.length;
}

async function scheduleEngagementJob(params: {
  guestId: string;
  restaurantId: string;
  type: EngagementJobType;
  triggerAt: Date;
}): Promise<EngagementJobRow> {
  const existingJob = await findPendingEngagementJob(params);
  if (existingJob) return existingJob;

  const messageCategory = getEngagementMessageCategory(params.type);
  if (messageCategory === "promotional") {
    const eligibility = await evaluatePromotionalEligibility(params);
    if (!eligibility.allowed) {
      return createSkippedEngagementJob({
        ...params,
        skipReason: eligibility.reason,
      });
    }
  }

  const [job] = await db
    .insert(engagementJobs)
    .values({
      restaurantId: params.restaurantId,
      guestId: params.guestId,
      type: params.type,
      messageCategory,
      triggerAt: params.triggerAt,
      status: "pending",
    })
    .returning();

  if (!job) throw new Error("Failed to create engagement job");

  const delay = params.triggerAt.getTime() - Date.now();
  await engagementQueue.add(
    "engagement",
    { jobId: job.id, type: params.type, guestId: params.guestId, restaurantId: params.restaurantId },
    { delay: Math.max(0, delay), jobId: `engagement-${job.id}` },
  );

  return job;
}

export async function shouldSendEngagementJob(job: EngagementJobRow): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (job.status !== "pending") {
    return { allowed: false, reason: `job_status_${job.status}` };
  }

  if (job.messageCategory !== "promotional") {
    return { allowed: true };
  }

  return evaluatePromotionalEligibility({
    guestId: job.guestId,
    restaurantId: job.restaurantId,
    triggerAt: new Date(),
    excludeJobId: job.id,
  });
}

/**
 * Schedule a thank-you message 2 hours after reservation completion.
 */
export async function scheduleThankYou(
  guestId: string,
  restaurantId: string,
  _reservationId: string,
): Promise<EngagementJobRow> {
  const triggerAt = await applyRestaurantQuietHours(restaurantId, new Date(Date.now() + THANK_YOU_DELAY_MS));
  return scheduleEngagementJob({ guestId, restaurantId, type: "thank_you", triggerAt });
}

/**
 * Schedule a birthday greeting for a guest.
 * Looks at guest preferences for birthday field, schedules for that date at 10:00 Asia/Jerusalem.
 */
export async function scheduleBirthdayGreeting(
  guestId: string,
  restaurantId: string,
): Promise<EngagementJobRow | null> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest) return null;

  const prefs = guest.preferences as Record<string, unknown> | null;
  const birthday = prefs?.birthday as string | undefined;
  if (!birthday) return null;

  // birthday expected as "MM-DD" or "YYYY-MM-DD"; extract month and day
  const parts = birthday.split("-");
  const month = parts.length === 3 ? parts[1] : parts[0];
  const day = parts.length === 3 ? parts[2] : parts[1];

  if (!month || !day) return null;

  // Calculate next birthday occurrence
  const now = new Date();
  const currentYear = now.getFullYear();
  let triggerAt = new Date(`${currentYear}-${month}-${day}T10:00:00+03:00`);

  // If birthday already passed this year, schedule for next year
  if (triggerAt.getTime() < now.getTime()) {
    triggerAt = new Date(`${currentYear + 1}-${month}-${day}T10:00:00+03:00`);
  }

  return scheduleEngagementJob({ guestId, restaurantId, type: "birthday", triggerAt });
}

function getBirthdayMonthDay(birthday: unknown): string | null {
  if (typeof birthday !== "string") return null;
  const normalized = birthday.trim();
  if (/^\d{2}-\d{2}$/.test(normalized)) return normalized;
  const isoDate = normalized.match(/^\d{4}-(\d{2}-\d{2})$/);
  return isoDate?.[1] ?? null;
}

function getJerusalemMonthDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${month}-${day}`;
}

function getBirthdayTriggerAt(monthDay: string, referenceDate = new Date()): Date | null {
  const [month, day] = monthDay.split("-");
  if (!month || !day) return null;

  const jerusalemYear = Number(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).format(referenceDate));
  const target = new Date(`${jerusalemYear}-${month}-${day}T10:00:00+03:00`);
  if (Number.isNaN(target.getTime())) return null;

  return target.getTime() < referenceDate.getTime()
    ? new Date(referenceDate.getTime() + 60 * 1000)
    : target;
}

export interface BirthdayCheckResult {
  scheduled: number;
  skippedExisting: number;
  skippedPolicy: number;
  skippedInvalidBirthday: number;
  due: number;
}

export interface AnniversaryCheckResult {
  scheduled: number;
  skippedExisting: number;
  skippedPolicy: number;
  skippedInvalidFirstVisit: number;
  due: number;
}

/**
 * Find guests with birthdays today and schedule a promotional greeting.
 */
export async function checkBirthdays(restaurantId: string): Promise<BirthdayCheckResult> {
  const result: BirthdayCheckResult = {
    scheduled: 0,
    skippedExisting: 0,
    skippedPolicy: 0,
    skippedInvalidBirthday: 0,
    due: 0,
  };
  const todayMonthDay = getJerusalemMonthDay();
  const triggerAt = getBirthdayTriggerAt(todayMonthDay);
  if (!triggerAt) return result;

  const windowStart = new Date(triggerAt);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  const restaurantGuests = await db
    .select()
    .from(guests)
    .where(eq(guests.restaurantId, restaurantId));

  for (const guest of restaurantGuests) {
    const prefs = guest.preferences as Record<string, unknown> | null;
    if (!prefs || !("birthday" in prefs)) continue;

    const monthDay = getBirthdayMonthDay(prefs.birthday);
    if (!monthDay) {
      result.skippedInvalidBirthday++;
      continue;
    }
    if (monthDay !== todayMonthDay) continue;

    result.due++;
    const existingJob = await findEngagementJobInWindow({
      restaurantId,
      guestId: guest.id,
      type: "birthday",
      windowStart,
      windowEnd,
    });
    if (existingJob) {
      result.skippedExisting++;
      continue;
    }

    const job = await scheduleEngagementJob({
      restaurantId,
      guestId: guest.id,
      type: "birthday",
      triggerAt,
    });

    if (job.status === "pending") {
      result.scheduled++;
    } else if (job.status === "skipped") {
      result.skippedPolicy++;
    }
  }

  return result;
}

function getDateMonthDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2}-\d{2})$/);
  return match?.[2] ?? null;
}

function getDateYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-\d{2}-\d{2}$/);
  return match ? Number(match[1]) : null;
}

export async function checkAnniversaries(restaurantId: string): Promise<AnniversaryCheckResult> {
  const result: AnniversaryCheckResult = {
    scheduled: 0,
    skippedExisting: 0,
    skippedPolicy: 0,
    skippedInvalidFirstVisit: 0,
    due: 0,
  };
  const todayMonthDay = getJerusalemMonthDay();
  const triggerAt = getBirthdayTriggerAt(todayMonthDay);
  if (!triggerAt) return result;

  const jerusalemYear = Number(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).format(new Date()));
  const windowStart = new Date(triggerAt);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  const restaurantGuests = await db
    .select()
    .from(guests)
    .where(eq(guests.restaurantId, restaurantId));

  for (const guest of restaurantGuests) {
    if (!guest.firstVisitDate) continue;

    const monthDay = getDateMonthDay(guest.firstVisitDate);
    const firstVisitYear = getDateYear(guest.firstVisitDate);
    if (!monthDay || !firstVisitYear) {
      result.skippedInvalidFirstVisit++;
      continue;
    }
    if (monthDay !== todayMonthDay || firstVisitYear >= jerusalemYear) continue;

    result.due++;
    const existingJob = await findEngagementJobInWindow({
      restaurantId,
      guestId: guest.id,
      type: "anniversary",
      windowStart,
      windowEnd,
    });
    if (existingJob) {
      result.skippedExisting++;
      continue;
    }

    const job = await scheduleEngagementJob({
      restaurantId,
      guestId: guest.id,
      type: "anniversary",
      triggerAt,
    });

    if (job.status === "pending") {
      result.scheduled++;
    } else if (job.status === "skipped") {
      result.skippedPolicy++;
    }
  }

  return result;
}

/**
 * Schedule a review request 24h after visit completion.
 * Only for guests with visitCount >= 3.
 */
export async function scheduleReviewRequest(
  guestId: string,
  restaurantId: string,
  reservationId: string,
): Promise<EngagementJobRow | null> {
  const [positiveFeedback] = await db
    .select({ id: visitLogs.id })
    .from(visitLogs)
    .where(
      and(
        eq(visitLogs.guestId, guestId),
        eq(visitLogs.restaurantId, restaurantId),
        eq(visitLogs.reservationId, reservationId),
        eq(visitLogs.sentiment, "positive"),
      ),
    )
    .limit(1);

  if (!positiveFeedback) return null;

  const result = await scheduleReviewRequestForPositiveFeedback({ guestId, restaurantId });
  return result?.job ?? null;
}

export function buildGoogleReviewUrl(params: {
  googlePlaceId?: string | null;
  restaurantName?: string | null;
}): string | null {
  if (params.googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(params.googlePlaceId)}`;
  }
  if (params.restaurantName) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${params.restaurantName} Google review`)}`;
  }
  return null;
}

export async function scheduleReviewRequestForPositiveFeedback(params: {
  guestId: string;
  restaurantId: string;
}): Promise<{ job: EngagementJobRow; reviewUrl: string | null; delayHours: number } | null> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, params.guestId))
    .limit(1);

  const [restaurant] = await db
    .select({
      name: restaurants.name,
      googlePlaceId: restaurants.googlePlaceId,
    })
    .from(restaurants)
    .where(eq(restaurants.id, params.restaurantId))
    .limit(1);

  if (!guest || !restaurant) return null;

  const delayMs = guest.visitCount <= 1 ? FIRST_TIME_REVIEW_DELAY_MS : REGULAR_REVIEW_DELAY_MS;
  const triggerAt = await applyRestaurantQuietHours(params.restaurantId, new Date(Date.now() + delayMs));
  const job = await scheduleEngagementJob({
    guestId: params.guestId,
    restaurantId: params.restaurantId,
    type: "review_request",
    triggerAt,
  });

  return {
    job,
    reviewUrl: buildGoogleReviewUrl({
      googlePlaceId: restaurant.googlePlaceId,
      restaurantName: restaurant.name,
    }),
    delayHours: delayMs / (60 * 60 * 1000),
  };
}

export async function routeNegativeFeedbackForRecovery(params: {
  guestId: string;
  restaurantId: string;
}): Promise<{
  skippedReviewRequests: number;
  ownerContact: string | null;
  recoveryActions: string[];
}> {
  const skippedReviewRequests = await skipPendingEngagementJobs({
    guestId: params.guestId,
    restaurantId: params.restaurantId,
    type: "review_request",
    reason: "negative_feedback_service_recovery",
  });

  const [restaurant] = await db
    .select({
      ownerWhatsapp: restaurants.ownerWhatsapp,
      ownerPhone: restaurants.ownerPhone,
    })
    .from(restaurants)
    .where(eq(restaurants.id, params.restaurantId))
    .limit(1);

  return {
    skippedReviewRequests,
    ownerContact: restaurant?.ownerWhatsapp ?? restaurant?.ownerPhone ?? null,
    recoveryActions: [
      "send_personal_apology",
      "offer_next_visit_discount",
      "schedule_owner_call",
      "escalate_to_manager",
    ],
  };
}

export async function scheduleLeaderboardSummary(
  guestId: string,
  restaurantId: string,
  period: string,
): Promise<EngagementJobRow> {
  void period;
  const triggerAt = await applyRestaurantQuietHours(restaurantId, new Date(Date.now() + 5 * 60 * 1000));
  const existingJob = await findEngagementJobInWindow({
    guestId,
    restaurantId,
    type: "leaderboard_summary",
    windowStart: new Date(triggerAt.getTime() - WEEK_MS),
    windowEnd: new Date(triggerAt.getTime() + WEEK_MS),
  });
  if (existingJob) return existingJob;

  const job = await scheduleEngagementJob({
    guestId,
    restaurantId,
    type: "leaderboard_summary",
    triggerAt,
  });

  return job;
}

export async function scheduleLuckySpinReward(
  guestId: string,
  restaurantId: string,
): Promise<EngagementJobRow> {
  const triggerAt = await applyRestaurantQuietHours(restaurantId, new Date(Date.now() + 5 * 60 * 1000));
  return scheduleEngagementJob({
    guestId,
    restaurantId,
    type: "lucky_spin_reward",
    triggerAt,
  });
}

interface WinBackResult {
  scheduled30: number;
  scheduled60: number;
  scheduled90: number;
  skippedExisting: number;
  skippedPolicy: number;
}

/**
 * Find guests who haven't visited in 30/60/90 days and schedule win-back messages.
 */
export async function checkWinBack(restaurantId: string): Promise<WinBackResult> {
  const result: WinBackResult = {
    scheduled30: 0,
    scheduled60: 0,
    scheduled90: 0,
    skippedExisting: 0,
    skippedPolicy: 0,
  };

  const today = new Date();
  const day30 = new Date(today);
  day30.setDate(day30.getDate() - 30);
  const day60 = new Date(today);
  day60.setDate(day60.getDate() - 60);
  const day90 = new Date(today);
  day90.setDate(day90.getDate() - 90);

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  const tiers: Array<{
    days: number;
    dateStr: string;
    olderThanDateStr?: string;
    type: "win_back_30" | "win_back_60" | "win_back_90";
    key: keyof WinBackResult;
  }> = [
    { days: 90, dateStr: toDateStr(day90), type: "win_back_90", key: "scheduled90" },
    { days: 60, dateStr: toDateStr(day60), olderThanDateStr: toDateStr(day90), type: "win_back_60", key: "scheduled60" },
    { days: 30, dateStr: toDateStr(day30), olderThanDateStr: toDateStr(day60), type: "win_back_30", key: "scheduled30" },
  ];

  for (const tier of tiers) {
    const conditions = [
      eq(guests.restaurantId, restaurantId),
      lte(guests.lastVisitDate, tier.dateStr),
    ];
    if (tier.olderThanDateStr) {
      conditions.push(gt(guests.lastVisitDate, tier.olderThanDateStr));
    }

    // Find guests who are due or overdue for this tier. Windows prevent a 90-day lapsed
    // guest from also receiving the 30/60-day copy.
    const matchedGuests = await db
      .select()
      .from(guests)
      .where(and(...conditions));

    for (const guest of matchedGuests) {
      const existingJob = await findAnyEngagementJob({
        restaurantId,
        guestId: guest.id,
        type: tier.type,
      });
      if (existingJob) {
        result.skippedExisting++;
        continue;
      }

      const triggerAt = new Date();
      const job = await scheduleEngagementJob({
        restaurantId,
        guestId: guest.id,
        type: tier.type,
        triggerAt,
      });

      if (job.status === "pending") {
        result[tier.key]++;
      } else if (job.status === "skipped") {
        result.skippedPolicy++;
      }
    }
  }

  return result;
}

/**
 * List engagement jobs with optional filters.
 */
export async function listEngagementJobs(params: {
  restaurantId: string;
  guestId?: string;
  status?: string;
  messageCategory?: EngagementMessageCategory;
}): Promise<EngagementJobRow[]> {
  const conditions = [eq(engagementJobs.restaurantId, params.restaurantId)];

  if (params.guestId) {
    conditions.push(eq(engagementJobs.guestId, params.guestId));
  }
  if (params.status) {
    conditions.push(eq(engagementJobs.status, params.status));
  }
  if (params.messageCategory) {
    conditions.push(eq(engagementJobs.messageCategory, params.messageCategory));
  }

  return db
    .select()
    .from(engagementJobs)
    .where(and(...conditions))
    .orderBy(engagementJobs.triggerAt);
}
