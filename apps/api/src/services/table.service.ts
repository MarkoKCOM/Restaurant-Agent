import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { tables } from "../db/schema.js";

export type TableRow = InferSelectModel<typeof tables>;

export async function getActiveTablesForRestaurant(restaurantId: string): Promise<TableRow[]> {
  return db
    .select()
    .from(tables)
    .where(and(eq(tables.restaurantId, restaurantId), eq(tables.isActive, true)));
}

export async function listTables(params: {
  restaurantId?: string;
  includeInactive?: boolean;
}): Promise<TableRow[]> {
  const { restaurantId, includeInactive } = params;
  const includeInactiveBool = !!includeInactive;

  if (restaurantId) {
    if (includeInactiveBool) {
      return db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
    }

    return db
      .select()
      .from(tables)
      .where(
        and(eq(tables.restaurantId, restaurantId), eq(tables.isActive, true)),
      );
  }

  if (includeInactiveBool) {
    return db.select().from(tables);
  }

  return db.select().from(tables).where(eq(tables.isActive, true));
}

export async function createTable(input: {
  restaurantId: string;
  name: string;
  minSeats: number;
  maxSeats: number;
  zone?: string;
  combinableWith?: string[];
}): Promise<TableRow> {
  const [created] = await db
    .insert(tables)
    .values({
      restaurantId: input.restaurantId,
      name: input.name,
      minSeats: input.minSeats,
      maxSeats: input.maxSeats,
      zone: input.zone,
      combinableWith: input.combinableWith,
      isActive: true,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create table");
  }

  return created;
}

export async function updateTable(
  id: string,
  updates: Partial<{
    name: string;
    minSeats: number;
    maxSeats: number;
    zone?: string;
    combinableWith?: string[];
    isActive: boolean;
  }>,
): Promise<TableRow | null> {
  if (Object.keys(updates).length === 0) {
    const [existing] = await db.select().from(tables).where(eq(tables.id, id)).limit(1);
    return existing ?? null;
  }

  const [updated] = await db
    .update(tables)
    .set(updates as any)
    .where(eq(tables.id, id))
    .returning();

  return updated ?? null;
}

export async function deactivateTable(id: string): Promise<void> {
  await db
    .update(tables)
    .set({ isActive: false })
    .where(eq(tables.id, id));
}

export function pickBestTablesForParty(
  availableTables: TableRow[],
  partySize: number,
): string[] | null {
  if (availableTables.length === 0) return null;

  const singleTableCandidates = availableTables.filter(
    (t) => partySize >= t.minSeats && partySize <= t.maxSeats,
  );

  if (singleTableCandidates.length > 0) {
    singleTableCandidates.sort((a, b) => a.maxSeats - b.maxSeats);
    return [singleTableCandidates[0].id];
  }

  let bestCombo: { ids: string[]; capacity: number } | null = null;

  for (let i = 0; i < availableTables.length; i++) {
    for (let j = i + 1; j < availableTables.length; j++) {
      const t1 = availableTables[i];
      const t2 = availableTables[j];

      const minSeats = t1.minSeats + t2.minSeats;
      const maxSeats = t1.maxSeats + t2.maxSeats;

      if (partySize < minSeats || partySize > maxSeats) continue;

      if (!bestCombo || maxSeats < bestCombo.capacity) {
        bestCombo = { ids: [t1.id, t2.id], capacity: maxSeats };
      }
    }
  }

  return bestCombo?.ids ?? null;
}
