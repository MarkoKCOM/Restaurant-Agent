import { and, eq, desc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, visitLogs, reservations, challengeProgress, challenges } from "../db/schema.js";
import type { CreateGuestInput, Guest as DomainGuest } from "@openseat/domain";
import { getVisitHistory, getGuestInsights, getGuestDietaryProfile } from "./visit.service.js";
import { getGuestSentimentHistory } from "./feedback.service.js";

export type GuestRow = InferSelectModel<typeof guests>;

export function toDomainGuest(row: GuestRow): DomainGuest {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    language: row.language,
    source: row.source,
    visitCount: row.visitCount,
    noShowCount: row.noShowCount,
    tier: row.tier ?? "bronze",
    preferences: (row.preferences as Record<string, unknown> | null) ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function findOrCreateGuest(input: CreateGuestInput): Promise<GuestRow> {
  const [existing] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.restaurantId, input.restaurantId), eq(guests.phone, input.phone)))
    .limit(1);

  if (existing) {
    const shouldUpdate =
      (input.name && input.name !== existing.name) ||
      (input.email && input.email !== existing.email) ||
      (input.source && input.source !== existing.source);

    if (shouldUpdate) {
      const [updated] = await db
        .update(guests)
        .set({
          name: input.name || existing.name,
          email: input.email ?? existing.email,
          source: input.source ?? existing.source,
          updatedAt: new Date(),
        })
        .where(eq(guests.id, existing.id))
        .returning();

      return updated ?? existing;
    }

    return existing;
  }

  const [created] = await db
    .insert(guests)
    .values({
      restaurantId: input.restaurantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      language: input.language ?? "he",
      source: input.source ?? "web",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create guest");
  }

  return created;
}

export async function listGuests(params: { restaurantId?: string }): Promise<GuestRow[]> {
  const { restaurantId } = params;

  if (restaurantId) {
    return db.select().from(guests).where(eq(guests.restaurantId, restaurantId));
  }

  return db.select().from(guests);
}

export async function getGuestById(id: string): Promise<GuestRow | undefined> {
  const [row] = await db.select().from(guests).where(eq(guests.id, id)).limit(1);
  return row;
}

export async function updateGuestPreferences(
  id: string,
  data: {
    preferences?: Record<string, unknown>;
    tags?: string[];
    notes?: string;
  },
): Promise<GuestRow | null> {
  const update: Partial<GuestRow> & { [key: string]: unknown } = {};

  if (data.preferences !== undefined) {
    (update as any).preferences = data.preferences;
  }

  if (data.tags !== undefined) {
    (update as any).tags = data.tags;
  }

  if (data.notes !== undefined) {
    update.notes = data.notes;
  }

  if (Object.keys(update).length === 0) {
    const existing = await getGuestById(id);
    return existing ?? null;
  }

  update.updatedAt = new Date();

  const [updated] = await db.update(guests).set(update).where(eq(guests.id, id)).returning();
  return updated ?? null;
}

// ── Full Guest Profile (for WhatsApp bot context) ─────

export async function getFullGuestProfile(guestId: string) {
  const guest = await getGuestById(guestId);
  if (!guest) return null;

  const [visitHistory, insights, dietaryProfile, sentimentHistory] = await Promise.all([
    getVisitHistory(guestId, 20),
    getGuestInsights(guestId),
    getGuestDietaryProfile(guestId),
    getGuestSentimentHistory(guestId),
  ]);

  // Get active challenges progress
  const guestChallenges = await db
    .select({
      challengeName: challenges.name,
      challengeType: challenges.type,
      targetValue: challenges.targetValue,
      currentValue: challengeProgress.currentValue,
      status: challengeProgress.status,
      completedAt: challengeProgress.completedAt,
    })
    .from(challengeProgress)
    .innerJoin(challenges as any, eq(challengeProgress.challengeId, challenges.id))
    .where(eq(challengeProgress.guestId, guestId));

  // Compute loyalty status
  const loyaltyStatus = {
    tier: guest.tier ?? "bronze",
    pointsBalance: guest.pointsBalance,
    visitCount: guest.visitCount,
    noShowCount: guest.noShowCount,
  };

  // Compute visit streak (consecutive weeks with visits)
  let streak = 0;
  if (visitHistory.length > 0) {
    const now = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let weekStart = new Date(now.getTime() - weekMs);
    for (let i = 0; i < 52; i++) {
      const weekEnd = new Date(weekStart.getTime() + weekMs);
      const hasVisit = visitHistory.some((v) => {
        const vDate = new Date(v.date);
        return vDate >= weekStart && vDate < weekEnd;
      });
      if (hasVisit) {
        streak++;
        weekStart = new Date(weekStart.getTime() - weekMs);
      } else {
        break;
      }
    }
  }

  return {
    guest: toDomainGuest(guest),
    visitHistory,
    insights,
    dietaryProfile,
    sentimentHistory,
    loyaltyStatus,
    challenges: guestChallenges,
    streak,
  };
}

// ── Visit-count auto-tags (Hebrew) ───────────────────

/** Tags automatically assigned based on visitCount thresholds */
const VISIT_AUTO_TAGS = ["חדש", "חוזר", "קבוע", "VIP"] as const;

/**
 * Compute the correct visit-count tag for a given count.
 * Returns the single tag that should be present.
 */
function visitCountTag(visitCount: number): string {
  if (visitCount >= 25) return "VIP";
  if (visitCount >= 10) return "קבוע";
  if (visitCount >= 3) return "חוזר";
  return "חדש";
}

/**
 * Apply visit-count auto-tags to an existing tags array.
 * Removes any stale visit-count auto-tags and adds the correct one.
 * Preserves all other (manual + insight-based) tags.
 */
function applyVisitAutoTags(currentTags: string[], visitCount: number): string[] {
  const visitAutoSet = new Set<string>(VISIT_AUTO_TAGS);
  // Strip old visit-count tags
  const filtered = currentTags.filter((t) => !visitAutoSet.has(t));
  // Add the correct one
  filtered.push(visitCountTag(visitCount));
  return filtered;
}

// ── Auto-Tag Guest (full) ────────────────────────────

/** All tags that autoTagGuest may write (visit + insight-based) */
const ALL_AUTO_TAGS = new Set([
  ...VISIT_AUTO_TAGS,
  "vip",        // legacy english — kept for back-compat detection
  "regular",
  "returning",
  "new",
  "lapsed",
  "happy",
  "at_risk",
  "big_spender",
]);

export async function autoTagGuest(guestId: string) {
  const guest = await getGuestById(guestId);
  if (!guest) return null;

  const insights = await getGuestInsights(guestId);
  const currentTags = (guest.tags as string[] | null) ?? [];

  // Keep manual tags (anything not auto-generated)
  const manualTags = currentTags.filter((t) => !ALL_AUTO_TAGS.has(t));
  const newTags = new Set(manualTags);

  // Visit count based tags (Hebrew)
  newTags.add(visitCountTag(guest.visitCount));

  // Lapsed check
  if (guest.lastVisitDate) {
    const daysSinceVisit =
      (Date.now() - new Date(guest.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVisit > 30) {
      newTags.add("lapsed");
    }
  }

  // Rating based tags
  if (insights.averageRating != null) {
    if (insights.averageRating >= 4) {
      newTags.add("happy");
    } else if (insights.averageRating <= 2) {
      newTags.add("at_risk");
    }
  }

  // Spend based tags (totalSpend is in agorot/cents, 500 NIS = 50000 agorot)
  if (insights.totalSpend > 50000) {
    newTags.add("big_spender");
  }

  const tagsArray = Array.from(newTags);

  await db
    .update(guests)
    .set({ tags: tagsArray, updatedAt: new Date() })
    .where(eq(guests.id, guestId));

  return tagsArray;
}

// ── Quick visit-count re-tag (called on reservation completion) ──

/**
 * Lightweight auto-tag update that only touches visit-count tags.
 * Called from the reservation completion flow after visitCount is incremented.
 */
export async function refreshVisitAutoTags(guestId: string): Promise<string[] | null> {
  const guest = await getGuestById(guestId);
  if (!guest) return null;

  const currentTags = (guest.tags as string[] | null) ?? [];
  const updatedTags = applyVisitAutoTags(currentTags, guest.visitCount);

  // Only write if something changed
  const changed =
    updatedTags.length !== currentTags.length ||
    updatedTags.some((t, i) => t !== currentTags[i]);

  if (changed) {
    await db
      .update(guests)
      .set({ tags: updatedTags, updatedAt: new Date() })
      .where(eq(guests.id, guestId));
  }

  return updatedTags;
}
