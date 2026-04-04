import { and, eq, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { visitLogs, guests, reservations } from "../db/schema.js";

// ── Types ─────────────────────────────────────────────

export interface LogVisitInput {
  restaurantId: string;
  guestId: string;
  reservationId?: string;
  date: string;
  partySize?: number;
  items?: Array<{ name: string; category: string; price?: number; rating?: number }>;
  totalSpend?: number;
  feedback?: string;
  rating?: number;
  sentiment?: string;
  staffNotes?: string;
  occasion?: string;
  dietaryNotes?: {
    vegetarian?: boolean;
    vegan?: boolean;
    glutenFree?: boolean;
    allergies?: string[];
    kosher?: string;
    other?: string;
  };
  channel?: "whatsapp" | "web" | "sms";
}

export interface GuestInsights {
  totalSpend: number;
  averageSpend: number;
  averageRating: number | null;
  favoriteItems: Array<{ name: string; count: number }>;
  dietaryProfile: {
    vegetarian?: boolean;
    vegan?: boolean;
    glutenFree?: boolean;
    allergies: string[];
    kosher?: string;
    other?: string;
  };
  occasions: string[];
  lastFeedback: string | null;
  visitFrequency: number | null;
  dayPreference: string | null;
  timePreference: string | null;
  partyPreference: number | null;
  totalVisits: number;
}

// ── Core Functions ────────────────────────────────────

export async function logVisit(data: LogVisitInput) {
  const [visit] = await db
    .insert(visitLogs)
    .values({
      restaurantId: data.restaurantId,
      guestId: data.guestId,
      reservationId: data.reservationId ?? null,
      date: data.date,
      partySize: data.partySize ?? null,
      items: data.items ?? null,
      totalSpend: data.totalSpend ?? null,
      feedback: data.feedback ?? null,
      rating: data.rating ?? null,
      sentiment: data.sentiment ?? null,
      staffNotes: data.staffNotes ?? null,
      occasion: data.occasion ?? null,
      dietaryNotes: data.dietaryNotes ?? null,
      channel: data.channel ?? null,
    })
    .returning();

  if (!visit) throw new Error("Failed to create visit log");

  // Update guest visit count and last visit date
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, data.guestId))
    .limit(1);

  if (guest) {
    const newVisitCount = guest.visitCount + 1;
    const updates: Record<string, unknown> = {
      visitCount: newVisitCount,
      lastVisitDate: data.date,
      updatedAt: new Date(),
    };
    if (!guest.firstVisitDate) {
      updates.firstVisitDate = data.date;
    }
    await db.update(guests).set(updates).where(eq(guests.id, data.guestId));
  }

  return visit;
}

export async function getVisitHistory(guestId: string, limit = 20) {
  return db
    .select()
    .from(visitLogs)
    .where(eq(visitLogs.guestId, guestId))
    .orderBy(desc(visitLogs.date))
    .limit(limit);
}

export async function getGuestInsights(guestId: string): Promise<GuestInsights> {
  const visits = await db
    .select()
    .from(visitLogs)
    .where(eq(visitLogs.guestId, guestId))
    .orderBy(desc(visitLogs.date));

  // Also pull reservation data for time/day preferences
  const guestReservations = await db
    .select()
    .from(reservations)
    .where(eq(reservations.guestId, guestId))
    .orderBy(desc(reservations.date));

  const totalSpend = visits.reduce((sum, v) => sum + (v.totalSpend ?? 0), 0);
  const totalVisits = visits.length;
  const averageSpend = totalVisits > 0 ? Math.round(totalSpend / totalVisits) : 0;

  // Average rating
  const ratedVisits = visits.filter((v) => v.rating != null);
  const averageRating =
    ratedVisits.length > 0
      ? Math.round(
          (ratedVisits.reduce((sum, v) => sum + v.rating!, 0) / ratedVisits.length) * 10,
        ) / 10
      : null;

  // Favorite items — count occurrences
  const itemCounts = new Map<string, number>();
  for (const visit of visits) {
    const items = visit.items as Array<{ name: string }> | null;
    if (!items) continue;
    for (const item of items) {
      itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + 1);
    }
  }
  const favoriteItems = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Merged dietary profile
  const dietaryProfile: GuestInsights["dietaryProfile"] = { allergies: [] };
  const allergySet = new Set<string>();
  for (const visit of visits) {
    const dn = visit.dietaryNotes as LogVisitInput["dietaryNotes"];
    if (!dn) continue;
    if (dn.vegetarian) dietaryProfile.vegetarian = true;
    if (dn.vegan) dietaryProfile.vegan = true;
    if (dn.glutenFree) dietaryProfile.glutenFree = true;
    if (dn.kosher) dietaryProfile.kosher = dn.kosher;
    if (dn.other) dietaryProfile.other = dn.other;
    if (dn.allergies) dn.allergies.forEach((a) => allergySet.add(a));
  }
  dietaryProfile.allergies = Array.from(allergySet);

  // Occasions
  const occasionSet = new Set<string>();
  for (const visit of visits) {
    if (visit.occasion) occasionSet.add(visit.occasion);
  }

  // Last feedback
  const lastFeedbackVisit = visits.find((v) => v.feedback);
  const lastFeedback = lastFeedbackVisit?.feedback ?? null;

  // Visit frequency — average days between visits
  let visitFrequency: number | null = null;
  if (visits.length >= 2) {
    const dates = visits.map((v) => new Date(v.date).getTime()).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i]! - dates[i - 1]!) / (1000 * 60 * 60 * 24));
    }
    visitFrequency = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  // Day preference from reservations
  const dayCounts = new Map<string, number>();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (const r of guestReservations) {
    const day = dayNames[new Date(r.date).getDay()]!;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const dayPreference =
    dayCounts.size > 0
      ? Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0]![0]
      : null;

  // Time preference from reservations
  const timeCounts = new Map<string, number>();
  for (const r of guestReservations) {
    if (!r.timeStart) continue;
    const hour = parseInt(r.timeStart.split(":")[0]!, 10);
    let slot: string;
    if (hour < 12) slot = "morning";
    else if (hour < 15) slot = "lunch";
    else if (hour < 18) slot = "afternoon";
    else slot = "dinner";
    timeCounts.set(slot, (timeCounts.get(slot) ?? 0) + 1);
  }
  const timePreference =
    timeCounts.size > 0
      ? Array.from(timeCounts.entries()).sort((a, b) => b[1] - a[1])[0]![0]
      : null;

  // Party size preference
  const partyCounts = new Map<number, number>();
  for (const v of visits) {
    if (v.partySize) {
      partyCounts.set(v.partySize, (partyCounts.get(v.partySize) ?? 0) + 1);
    }
  }
  const partyPreference =
    partyCounts.size > 0
      ? Array.from(partyCounts.entries()).sort((a, b) => b[1] - a[1])[0]![0]
      : null;

  return {
    totalSpend,
    averageSpend,
    averageRating,
    favoriteItems,
    dietaryProfile,
    occasions: Array.from(occasionSet),
    lastFeedback,
    visitFrequency,
    dayPreference,
    timePreference,
    partyPreference,
    totalVisits,
  };
}

export async function getGuestDietaryProfile(guestId: string) {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  const visits = await db
    .select()
    .from(visitLogs)
    .where(eq(visitLogs.guestId, guestId));

  // Merge from visits
  const merged: {
    vegetarian?: boolean;
    vegan?: boolean;
    glutenFree?: boolean;
    allergies: string[];
    kosher?: string;
    other?: string;
  } = { allergies: [] };

  const allergySet = new Set<string>();

  for (const visit of visits) {
    const dn = visit.dietaryNotes as LogVisitInput["dietaryNotes"];
    if (!dn) continue;
    if (dn.vegetarian) merged.vegetarian = true;
    if (dn.vegan) merged.vegan = true;
    if (dn.glutenFree) merged.glutenFree = true;
    if (dn.kosher) merged.kosher = dn.kosher;
    if (dn.other) merged.other = dn.other;
    if (dn.allergies) dn.allergies.forEach((a) => allergySet.add(a));
  }

  // Merge from guest preferences
  if (guest?.preferences) {
    const prefs = guest.preferences as Record<string, unknown>;
    if (prefs.dietary) {
      const d = prefs.dietary as Record<string, unknown>;
      if (d.vegetarian) merged.vegetarian = true;
      if (d.vegan) merged.vegan = true;
      if (d.glutenFree) merged.glutenFree = true;
      if (d.kosher) merged.kosher = d.kosher as string;
      if (Array.isArray(d.allergies)) {
        (d.allergies as string[]).forEach((a) => allergySet.add(a));
      }
    }
  }

  merged.allergies = Array.from(allergySet);
  return merged;
}

export async function updateGuestPreferencesFromVisits(guestId: string) {
  const insights = await getGuestInsights(guestId);

  const preferences: Record<string, unknown> = {};

  // Merge existing preferences
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  if (guest?.preferences) {
    Object.assign(preferences, guest.preferences as Record<string, unknown>);
  }

  // Update with aggregated data
  if (insights.favoriteItems.length > 0) {
    preferences.favoriteItems = insights.favoriteItems.map((i) => i.name);
  }
  if (insights.dietaryProfile.allergies.length > 0 || insights.dietaryProfile.vegetarian || insights.dietaryProfile.vegan || insights.dietaryProfile.glutenFree) {
    preferences.dietary = insights.dietaryProfile;
  }
  if (insights.occasions.length > 0) {
    preferences.occasions = insights.occasions;
  }
  if (insights.dayPreference) {
    preferences.dayPreference = insights.dayPreference;
  }
  if (insights.timePreference) {
    preferences.timePreference = insights.timePreference;
  }
  if (insights.partyPreference) {
    preferences.partyPreference = insights.partyPreference;
  }

  await db
    .update(guests)
    .set({ preferences, updatedAt: new Date() })
    .where(eq(guests.id, guestId));

  return preferences;
}
