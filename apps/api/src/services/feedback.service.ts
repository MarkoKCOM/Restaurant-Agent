import type { FastifyBaseLogger } from "fastify";
import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { visitLogs, guests } from "../db/schema.js";
import { env } from "../env.js";
import {
  routeNegativeFeedbackForRecovery,
  scheduleReviewRequestForPositiveFeedback,
} from "./engagement.service.js";

// ── Types ─────────────────────────────────────────────

export interface SubmitFeedbackInput {
  guestId: string;
  restaurantId: string;
  reservationId?: string;
  rating: number;
  feedback?: string;
  channel: "whatsapp" | "web" | "sms";
}

export interface SubmitFeedbackOptions {
  logger?: FastifyBaseLogger;
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

export interface ReviewRoutingResult {
  route: "public_review" | "private_recovery" | "neutral_followup";
  sentiment: "positive" | "neutral" | "negative";
  sentimentAnalysis: FeedbackSentimentAnalysis;
  reviewUrl?: string | null;
  engagementJobId?: string | null;
  engagementJobStatus?: string | null;
  delayHours?: number | null;
  ownerContact?: string | null;
  skippedReviewRequests?: number;
  recoveryActions?: string[];
}

export interface SubmitFeedbackResult {
  visit: typeof visitLogs.$inferSelect;
  reviewRouting: ReviewRoutingResult;
}

export interface FeedbackSentimentAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  source: "rating" | "rules" | "llm" | "llm_fallback";
  confidence: number;
  positiveSignals: string[];
  negativeSignals: string[];
  ratingSentiment: "positive" | "neutral" | "negative";
}

const NEGATIVE_FEEDBACK_PATTERNS = [
  /\b(cold|terrible|awful|bad|rude|slow|dirty|waited|waiting|late|wrong|burnt|overcooked|undercooked|disappointed|disappointing|complaint|refund|sick|inedible)\b/i,
  /לא טוב|גרוע|נורא|קר|חיכינו|איחור|מלוכלך|גס|מאכזב|תלונה|החזר|לא אכיל/u,
  /سيء|بارد|انتظرنا|متأخر|وسخ|شكوى|محبط|غير صالح/u,
];

const POSITIVE_FEEDBACK_PATTERNS = [
  /\b(amazing|excellent|great|good|loved|love|perfect|delicious|wonderful|fantastic|friendly|recommend|best)\b/i,
  /מעולה|מדהים|טעים|אהבנו|מושלם|נהדר|מצוין|נחזור|ממליץ/u,
  /ممتاز|رائع|لذيذ|أحببنا|مثالي|جميل|سنعود/u,
];

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const SENTIMENT_LLM_TIMEOUT_MS = 8_000;

function sentimentLlmLogContext(params: {
  rating: number;
  ratingSentiment: "positive" | "neutral" | "negative";
  feedback: string;
}) {
  return {
    code: "FEEDBACK_SENTIMENT_LLM_FALLBACK",
    model: env.SENTIMENT_MODEL,
    rating: params.rating,
    ratingSentiment: params.ratingSentiment,
    feedbackLength: params.feedback.length,
  };
}

function getRatingSentiment(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

function collectSignals(feedback: string | undefined, patterns: RegExp[]): string[] {
  if (!feedback) return [];
  return patterns
    .filter((pattern) => pattern.test(feedback))
    .map((pattern) => pattern.source)
    .slice(0, 5);
}

async function analyzeAmbiguousFeedbackWithLlm(params: {
  rating: number;
  feedback: string;
  ratingSentiment: "positive" | "neutral" | "negative";
  logger?: FastifyBaseLogger;
}): Promise<FeedbackSentimentAnalysis | null> {
  if (!env.OPENROUTER_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SENTIMENT_LLM_TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.SENTIMENT_MODEL,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Classify restaurant guest feedback sentiment. Return JSON only: {\"sentiment\":\"positive|neutral|negative\",\"confidence\":0..1,\"positiveSignals\":[string],\"negativeSignals\":[string]}. Treat service complaints, cold food, long waits, rude staff, illness, refund requests, or disappointment as negative even if the star rating is high.",
          },
          {
            role: "user",
            content: JSON.stringify({
              rating: params.rating,
              ratingSentiment: params.ratingSentiment,
              feedback: params.feedback.slice(0, 1000),
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      params.logger?.warn(
        {
          ...sentimentLlmLogContext(params),
          reason: "provider_error",
          providerStatus: res.status,
          providerStatusText: res.statusText,
        },
        "Feedback sentiment LLM request failed",
      );
      return null;
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    } catch (error: unknown) {
      params.logger?.warn(
        {
          ...sentimentLlmLogContext(params),
          err: error,
          reason: "invalid_provider_json",
        },
        "Feedback sentiment LLM response parse failed",
      );
      return null;
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      params.logger?.warn(
        {
          ...sentimentLlmLogContext(params),
          reason: "missing_content",
          choiceCount: data.choices?.length ?? 0,
        },
        "Feedback sentiment LLM response missing content",
      );
      return null;
    }

    let parsed: Partial<FeedbackSentimentAnalysis>;
    try {
      parsed = JSON.parse(content) as Partial<FeedbackSentimentAnalysis>;
    } catch (error: unknown) {
      params.logger?.warn(
        {
          ...sentimentLlmLogContext(params),
          err: error,
          reason: "invalid_content_json",
          contentLength: content.length,
        },
        "Feedback sentiment LLM content parse failed",
      );
      return null;
    }

    const sentiment = parsed.sentiment;
    if (sentiment !== "positive" && sentiment !== "neutral" && sentiment !== "negative") {
      params.logger?.warn(
        {
          ...sentimentLlmLogContext(params),
          reason: "invalid_sentiment",
          sentiment,
        },
        "Feedback sentiment LLM returned invalid sentiment",
      );
      return null;
    }

    return {
      sentiment,
      source: "llm",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.6,
      positiveSignals: Array.isArray(parsed.positiveSignals) ? parsed.positiveSignals.filter((item): item is string => typeof item === "string").slice(0, 5) : [],
      negativeSignals: Array.isArray(parsed.negativeSignals) ? parsed.negativeSignals.filter((item): item is string => typeof item === "string").slice(0, 5) : [],
      ratingSentiment: params.ratingSentiment,
    };
  } catch (error: unknown) {
    params.logger?.warn(
      {
        ...sentimentLlmLogContext(params),
        err: error,
        reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "request_failed",
      },
      "Feedback sentiment LLM analysis failed",
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeFeedbackSentiment(params: {
  rating: number;
  feedback?: string;
  logger?: FastifyBaseLogger;
}): Promise<FeedbackSentimentAnalysis> {
  const ratingSentiment = getRatingSentiment(params.rating);
  const positiveSignals = collectSignals(params.feedback, POSITIVE_FEEDBACK_PATTERNS);
  const negativeSignals = collectSignals(params.feedback, NEGATIVE_FEEDBACK_PATTERNS);

  if (negativeSignals.length > 0) {
    return {
      sentiment: "negative",
      source: "rules",
      confidence: Math.min(0.95, 0.72 + negativeSignals.length * 0.08),
      positiveSignals,
      negativeSignals,
      ratingSentiment,
    };
  }

  if (positiveSignals.length > 0 && params.rating >= 3) {
    return {
      sentiment: "positive",
      source: "rules",
      confidence: Math.min(0.92, 0.7 + positiveSignals.length * 0.07),
      positiveSignals,
      negativeSignals,
      ratingSentiment,
    };
  }

  const feedback = params.feedback?.trim();
  if (feedback && ratingSentiment === "neutral") {
    const llmAnalysis = await analyzeAmbiguousFeedbackWithLlm({
      rating: params.rating,
      feedback,
      ratingSentiment,
      logger: params.logger,
    });
    if (llmAnalysis) return llmAnalysis;
  }

  return {
    sentiment: ratingSentiment,
    source: feedback && ratingSentiment === "neutral" ? "llm_fallback" : "rating",
    confidence: ratingSentiment === "neutral" ? 0.5 : 0.68,
    positiveSignals,
    negativeSignals,
    ratingSentiment,
  };
}

// ── Core Functions ────────────────────────────────────

export async function submitFeedback(data: SubmitFeedbackInput, options: SubmitFeedbackOptions = {}): Promise<SubmitFeedbackResult> {
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

  const sentimentAnalysis = await analyzeFeedbackSentiment({
    rating: data.rating,
    feedback: data.feedback,
    logger: options.logger,
  });
  const sentiment = sentimentAnalysis.sentiment;

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

  // Auto-tag guest based on analyzed sentiment
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

    const sentimentLog = {
      sentiment,
      sentimentSource: sentimentAnalysis.source,
      sentimentConfidence: sentimentAnalysis.confidence,
      ratingSentiment: sentimentAnalysis.ratingSentiment,
      positiveSignals: sentimentAnalysis.positiveSignals,
      negativeSignals: sentimentAnalysis.negativeSignals,
    };

    if (sentiment === "positive") {
      tagSet.add("happy");
      options.logger?.info(
        {
          restaurantId: data.restaurantId,
          guestId: data.guestId,
          reservationId: data.reservationId,
          rating: data.rating,
          ...sentimentLog,
          channel: data.channel,
        },
        "Feedback should trigger review prompt",
      );
    } else if (sentiment === "negative") {
      tagSet.add("at_risk");
      options.logger?.warn(
        {
          restaurantId: data.restaurantId,
          guestId: data.guestId,
          reservationId: data.reservationId,
          rating: data.rating,
          ...sentimentLog,
          channel: data.channel,
        },
        "Feedback should alert owner",
      );
    } else {
      tagSet.add("neutral_feedback");
    }

    await db
      .update(guests)
      .set({ tags: Array.from(tagSet), updatedAt: new Date() })
      .where(eq(guests.id, data.guestId));
  }

  let reviewRouting: ReviewRoutingResult;
  if (sentiment === "positive") {
    const reviewRequest = await scheduleReviewRequestForPositiveFeedback({
      guestId: data.guestId,
      restaurantId: data.restaurantId,
    }, {
      logger: options.logger,
      reservationId: data.reservationId,
    });
    reviewRouting = {
      route: "public_review",
      sentiment,
      sentimentAnalysis,
      reviewUrl: reviewRequest?.reviewUrl ?? null,
      engagementJobId: reviewRequest?.job.id ?? null,
      engagementJobStatus: reviewRequest?.job.status ?? null,
      delayHours: reviewRequest?.delayHours ?? null,
    };
    options.logger?.info(
      {
        restaurantId: data.restaurantId,
        guestId: data.guestId,
        reservationId: data.reservationId,
        visitId: visit?.id,
        sentimentSource: sentimentAnalysis.source,
        sentimentConfidence: sentimentAnalysis.confidence,
        ratingSentiment: sentimentAnalysis.ratingSentiment,
        positiveSignals: sentimentAnalysis.positiveSignals,
        negativeSignals: sentimentAnalysis.negativeSignals,
        engagementJobId: reviewRouting.engagementJobId,
        engagementJobStatus: reviewRouting.engagementJobStatus,
        delayHours: reviewRouting.delayHours,
      },
      "Positive feedback routed to public review request",
    );
  } else if (sentiment === "negative") {
    const recovery = await routeNegativeFeedbackForRecovery({
      guestId: data.guestId,
      restaurantId: data.restaurantId,
    });
    reviewRouting = {
      route: "private_recovery",
      sentiment,
      sentimentAnalysis,
      ownerContact: recovery.ownerContact,
      skippedReviewRequests: recovery.skippedReviewRequests,
      recoveryActions: recovery.recoveryActions,
    };
    options.logger?.warn(
      {
        restaurantId: data.restaurantId,
        guestId: data.guestId,
        reservationId: data.reservationId,
        visitId: visit?.id,
        sentimentSource: sentimentAnalysis.source,
        sentimentConfidence: sentimentAnalysis.confidence,
        ratingSentiment: sentimentAnalysis.ratingSentiment,
        positiveSignals: sentimentAnalysis.positiveSignals,
        negativeSignals: sentimentAnalysis.negativeSignals,
        ownerContactConfigured: Boolean(recovery.ownerContact),
        skippedReviewRequests: recovery.skippedReviewRequests,
        recoveryActions: recovery.recoveryActions,
      },
      "Negative feedback routed to private service recovery",
    );
  } else {
    reviewRouting = {
      route: "neutral_followup",
      sentiment,
      sentimentAnalysis,
    };
  }

  if (!visit) throw new Error("Failed to submit feedback");
  return { visit, reviewRouting };
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
