import { and, eq, sql, lte, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { engagementJobs, guests, restaurants } from "../db/schema.js";
import { engagementQueue } from "../queue/index.js";
import type { InferSelectModel } from "drizzle-orm";

export type EngagementJobRow = InferSelectModel<typeof engagementJobs>;

/**
 * Schedule a thank-you message 2 hours after reservation completion.
 */
export async function scheduleThankYou(
  guestId: string,
  restaurantId: string,
  _reservationId: string,
): Promise<EngagementJobRow> {
  const triggerAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const [job] = await db
    .insert(engagementJobs)
    .values({
      restaurantId,
      guestId,
      type: "thank_you",
      triggerAt,
      status: "pending",
    })
    .returning();

  if (!job) throw new Error("Failed to create engagement job");

  const delay = triggerAt.getTime() - Date.now();
  await engagementQueue.add(
    "engagement",
    { jobId: job.id, type: "thank_you", guestId, restaurantId },
    { delay, jobId: `engagement-${job.id}` },
  );

  return job;
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

  const [job] = await db
    .insert(engagementJobs)
    .values({
      restaurantId,
      guestId,
      type: "birthday",
      triggerAt,
      status: "pending",
    })
    .returning();

  if (!job) throw new Error("Failed to create birthday engagement job");

  const delay = triggerAt.getTime() - Date.now();
  await engagementQueue.add(
    "engagement",
    { jobId: job.id, type: "birthday", guestId, restaurantId },
    { delay, jobId: `engagement-${job.id}` },
  );

  return job;
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

  const [job] = await db
    .insert(engagementJobs)
    .values({
      restaurantId,
      guestId,
      type: "review_request",
      triggerAt,
      status: "pending",
    })
    .returning();

  if (!job) throw new Error("Failed to create review request engagement job");

  const delay = triggerAt.getTime() - Date.now();
  await engagementQueue.add(
    "engagement",
    { jobId: job.id, type: "review_request", guestId, restaurantId },
    { delay, jobId: `engagement-${job.id}` },
  );

  return job;
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
          eq(guests.optedOutCampaigns, false),
        ),
      );

    for (const guest of matchedGuests) {
      // Check if we already have a pending win-back job for this guest
      const [existingJob] = await db
        .select()
        .from(engagementJobs)
        .where(
          and(
            eq(engagementJobs.guestId, guest.id),
            eq(engagementJobs.restaurantId, restaurantId),
            eq(engagementJobs.type, tier.type),
            eq(engagementJobs.status, "pending"),
          ),
        )
        .limit(1);

      if (existingJob) continue;

      // Schedule for now (process immediately)
      const triggerAt = new Date();

      const [job] = await db
        .insert(engagementJobs)
        .values({
          restaurantId,
          guestId: guest.id,
          type: tier.type,
          triggerAt,
          status: "pending",
        })
        .returning();

      if (job) {
        await engagementQueue.add(
          "engagement",
          { jobId: job.id, type: tier.type, guestId: guest.id, restaurantId },
          { jobId: `engagement-${job.id}` },
        );
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
}): Promise<EngagementJobRow[]> {
  const conditions = [eq(engagementJobs.restaurantId, params.restaurantId)];

  if (params.guestId) {
    conditions.push(eq(engagementJobs.guestId, params.guestId));
  }
  if (params.status) {
    conditions.push(eq(engagementJobs.status, params.status));
  }

  return db
    .select()
    .from(engagementJobs)
    .where(and(...conditions))
    .orderBy(engagementJobs.triggerAt);
}
