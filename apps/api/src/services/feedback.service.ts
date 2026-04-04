import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { visitLogs, guests } from "../db/schema.js";

// ── Types ─────────────────────────────────────────────

export interface SubmitFeedbackInput {
  guestId: string;
  restaurantId: string;
  reservationId?: string;
  rating: number;
  feedback?: string;
  channel: "whatsapp" | "web" | "sms";
}

export interface FeedbackSummary {
  averageRating: number | null;
  totalFeedback: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  recentComplaints: Array<{
    date: string;
    guestId: string;
    rating: number;
    feedback: string | null;
  }>;
}

// ── Core Functions ────────────────────────────────────

export async function submitFeedback(data: SubmitFeedbackInput) {
  // Check if a visit log already exists for this reservation
  let existingVisit = null;
  if (data.reservationId) {
    const [found] = await db
      .select()
      .from(visitLogs)
      .where(
        and(
          eq(visitLogs.guestId, data.guestId),
          eq(visitLogs.reservationId, data.reservationId),
        ),
      )
      .limit(1);
    existingVisit = found ?? null;
  }

  // Determine sentiment from rating
  let sentiment: string;
  if (data.rating >= 4) sentiment = "positive";
  else if (data.rating <= 2) sentiment = "negative";
  else sentiment = "neutral";

  let visit;
  if (existingVisit) {
    // Update existing visit log
    const [updated] = await db
      .update(visitLogs)
      .set({
        rating: data.rating,
        feedback: data.feedback ?? existingVisit.feedback,
        sentiment,
        channel: data.channel,
      })
      .where(eq(visitLogs.id, existingVisit.id))
      .returning();
    visit = updated;
  } else {
    // Create new visit log with just feedback
    const today = new Date().toISOString().split("T")[0]!;
    const [created] = await db
      .insert(visitLogs)
      .values({
        restaurantId: data.restaurantId,
        guestId: data.guestId,
        reservationId: data.reservationId ?? null,
        date: today,
        rating: data.rating,
        feedback: data.feedback ?? null,
        sentiment,
        channel: data.channel,
      })
      .returning();
    visit = created;
  }

  // Auto-tag guest based on rating
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, data.guestId))
    .limit(1);

  if (guest) {
    const currentTags = (guest.tags as string[] | null) ?? [];
    const tagSet = new Set(currentTags);

    // Remove previous sentiment tags before adding new one
    tagSet.delete("happy");
    tagSet.delete("at_risk");
    tagSet.delete("neutral_feedback");

    if (data.rating >= 4) {
      tagSet.add("happy");
      // Log: schedule Google Review prompt
      console.log(
        `[feedback] Guest ${data.guestId} rated ${data.rating}/5 — schedule Google Review prompt`,
      );
    } else if (data.rating <= 2) {
      tagSet.add("at_risk");
      // Log: alert owner
      console.log(
        `[feedback] Guest ${data.guestId} rated ${data.rating}/5 — ALERT OWNER: low rating`,
      );
    } else {
      tagSet.add("neutral_feedback");
    }

    await db
      .update(guests)
      .set({ tags: Array.from(tagSet), updatedAt: new Date() })
      .where(eq(guests.id, data.guestId));
  }

  return visit;
}

export async function getFeedbackSummary(
  restaurantId: string,
  dateRange?: { from?: string; to?: string },
): Promise<FeedbackSummary> {
  // Build conditions
  const conditions = [eq(visitLogs.restaurantId, restaurantId)];
  if (dateRange?.from) conditions.push(gte(visitLogs.date, dateRange.from));
  if (dateRange?.to) conditions.push(lte(visitLogs.date, dateRange.to));

  // Get all visits with feedback/rating for this restaurant
  const visits = await db
    .select()
    .from(visitLogs)
    .where(and(...conditions))
    .orderBy(desc(visitLogs.date));

  const withRating = visits.filter((v) => v.rating != null);
  const averageRating =
    withRating.length > 0
      ? Math.round(
          (withRating.reduce((sum, v) => sum + v.rating!, 0) / withRating.length) * 10,
        ) / 10
      : null;

  const totalFeedback = visits.filter((v) => v.feedback || v.rating != null).length;

  const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const v of visits) {
    if (v.sentiment === "positive") sentimentBreakdown.positive++;
    else if (v.sentiment === "negative") sentimentBreakdown.negative++;
    else if (v.sentiment === "neutral") sentimentBreakdown.neutral++;
  }

  // Recent complaints: rating <= 2, last 10
  const recentComplaints = visits
    .filter((v) => v.rating != null && v.rating <= 2)
    .slice(0, 10)
    .map((v) => ({
      date: v.date,
      guestId: v.guestId,
      rating: v.rating!,
      feedback: v.feedback,
    }));

  return {
    averageRating,
    totalFeedback,
    sentimentBreakdown,
    recentComplaints,
  };
}

export async function getGuestSentimentHistory(guestId: string) {
  const visits = await db
    .select({
      date: visitLogs.date,
      rating: visitLogs.rating,
      feedback: visitLogs.feedback,
      sentiment: visitLogs.sentiment,
    })
    .from(visitLogs)
    .where(
      and(eq(visitLogs.guestId, guestId), sql`${visitLogs.rating} IS NOT NULL`),
    )
    .orderBy(desc(visitLogs.date));

  return visits;
}
