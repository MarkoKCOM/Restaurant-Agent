import { and, eq, gte, inArray, lt, sql, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { engagementJobs, guests, restaurants } from "../db/schema.js";
import { engagementQueue } from "../queue/index.js";
import type { InferSelectModel } from "drizzle-orm";

export type EngagementJobRow = InferSelectModel<typeof engagementJobs>;
export type EngagementMessageCategory = "transactional" | "promotional";
export type EngagementJobType =
  | "thank_you"
  | "review_request"
  | "birthday"
  | "win_back_30"
  | "win_back_60"
  | "win_back_90";

export const PROMOTIONAL_ENGAGEMENT_TYPES = [
  "review_request",
  "birthday",
  "win_back_30",
  "win_back_60",
  "win_back_90",
] as const;

const PROMOTIONAL_WEEKLY_LIMIT = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getEngagementMessageCategory(type: string): EngagementMessageCategory {
  return PROMOTIONAL_ENGAGEMENT_TYPES.includes(type as typeof PROMOTIONAL_ENGAGEMENT_TYPES[number])
    ? "promotional"
    : "transactional";
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
  const triggerAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
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

/**
 * Schedule a review request 24h after visit completion.
 * Only for guests with visitCount >= 3.
 */
export async function scheduleReviewRequest(
  guestId: string,
  restaurantId: string,
  _reservationId: string,
): Promise<EngagementJobRow | null> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!guest || guest.visitCount < 3) return null;

  const triggerAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return scheduleEngagementJob({ guestId, restaurantId, type: "review_request", triggerAt });
}

interface WinBackResult {
  scheduled30: number;
  scheduled60: number;
  scheduled90: number;
}

/**
 * Find guests who haven't visited in 30/60/90 days and schedule win-back messages.
 */
export async function checkWinBack(restaurantId: string): Promise<WinBackResult> {
  const result: WinBackResult = { scheduled30: 0, scheduled60: 0, scheduled90: 0 };

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
    type: "win_back_30" | "win_back_60" | "win_back_90";
    key: keyof WinBackResult;
  }> = [
    { days: 30, dateStr: toDateStr(day30), type: "win_back_30", key: "scheduled30" },
    { days: 60, dateStr: toDateStr(day60), type: "win_back_60", key: "scheduled60" },
    { days: 90, dateStr: toDateStr(day90), type: "win_back_90", key: "scheduled90" },
  ];

  for (const tier of tiers) {
    // Find guests whose lastVisitDate matches exactly N days ago
    const matchedGuests = await db
      .select()
      .from(guests)
      .where(
        and(
          eq(guests.restaurantId, restaurantId),
          eq(guests.lastVisitDate, tier.dateStr),
        ),
      );

    for (const guest of matchedGuests) {
      // Schedule for now (process immediately)
      const triggerAt = new Date();
      const job = await scheduleEngagementJob({
        restaurantId,
        guestId: guest.id,
        type: tier.type,
        triggerAt,
      });

      if (job.status === "pending") {
        result[tier.key]++;
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
