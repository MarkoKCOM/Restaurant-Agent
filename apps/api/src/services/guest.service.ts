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
  const guestChallengeProgress = await db
    .select()
    .from(challengeProgress)
    .where(eq(challengeProgress.guestId, guestId));

  const restaurantChallenges = await db
    .select()
    .from(challenges)
    .where(eq(challenges.restaurantId, guest.restaurantId));
  const challengeById = new Map(restaurantChallenges.map((challenge) => [challenge.id, challenge]));

  const guestChallenges = guestChallengeProgress
    .map((progress) => {
      const challenge = challengeById.get(progress.challengeId);
      if (!challenge) return null;
      return {
        challengeName: challenge.name,
        challengeType: challenge.type,
        targetValue: challenge.targetValue,
        currentValue: progress.currentValue,
        status: progress.status,
        completedAt: progress.completedAt,
      };
    })
    .filter((challenge): challenge is NonNullable<typeof challenge> => challenge !== null);

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

// ── Auto-Tag Guest ────────────────────────────────────

export async function autoTagGuest(guestId: string) {
  const guest = await getGuestById(guestId);
  if (!guest) return null;

  const insights = await getGuestInsights(guestId);
  const currentTags = (guest.tags as string[] | null) ?? [];

  // Keep manual tags (anything not auto-generated)
  const autoTags = new Set([
    "vip",
    "regular",
    "returning",
    "new",
    "lapsed",
    "happy",
    "at_risk",
    "big_spender",
  ]);
  const manualTags = currentTags.filter((t) => !autoTags.has(t));
  const newTags = new Set(manualTags);

  // Visit count based tags
  if (guest.visitCount >= 15) {
    newTags.add("vip");
  } else if (guest.visitCount >= 5) {
    newTags.add("regular");
  } else if (guest.visitCount >= 1) {
    newTags.add("returning");
  } else {
    newTags.add("new");
  }

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
