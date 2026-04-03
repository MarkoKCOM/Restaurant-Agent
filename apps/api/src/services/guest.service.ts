import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests } from "../db/schema.js";
import type { CreateGuestInput, Guest as DomainGuest } from "@sable/domain";

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
