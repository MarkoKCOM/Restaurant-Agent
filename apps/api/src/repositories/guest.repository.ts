import { and, eq, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests } from "../db/schema.js";
import type { Executor } from "./types.js";

export type GuestRow = InferSelectModel<typeof guests>;
export type GuestInsert = InferInsertModel<typeof guests>;
export type GuestUpdate = Partial<Omit<GuestInsert, "id" | "restaurantId">>;

/**
 * Data access for the `guests` table.
 *
 * Tenant scoping note: several guest operations are keyed by the guest's global
 * UUID (`findById`/`updateById`) and are called from contexts that do not hold a
 * `restaurantId` (visit completion, WhatsApp bot, auto-tagging). Those by-PK
 * methods are marked below and preserve existing behavior. Threading a
 * `restaurantId` guard onto by-PK writes is part of the centralized-scoping work
 * (#5), not this migration.
 */
export const guestRepository = {
  /** Tenant-scoped: find a guest by phone within a restaurant. */
  async findByPhone(
    restaurantId: string,
    phone: string,
    executor: Executor = db,
  ): Promise<GuestRow | null> {
    const [row] = await executor
      .select()
      .from(guests)
      .where(and(eq(guests.restaurantId, restaurantId), eq(guests.phone, phone)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: all guests for a restaurant. */
  listByRestaurant(restaurantId: string, executor: Executor = db): Promise<GuestRow[]> {
    return executor.select().from(guests).where(eq(guests.restaurantId, restaurantId));
  },

  /** Unscoped: super-admin listing across every restaurant. */
  listAll(executor: Executor = db): Promise<GuestRow[]> {
    return executor.select().from(guests);
  },

  /** By global guest UUID. Caller already holds the specific id. */
  async findById(id: string, executor: Executor = db): Promise<GuestRow | null> {
    const [row] = await executor.select().from(guests).where(eq(guests.id, id)).limit(1);
    return row ?? null;
  },

  async insert(values: GuestInsert, executor: Executor = db): Promise<GuestRow> {
    const [created] = await executor.insert(guests).values(values).returning();
    if (!created) {
      throw new Error("Failed to create guest");
    }
    return created;
  },

  /** By global guest UUID. Returns the updated row, or null when none matched. */
  async updateById(
    id: string,
    updates: GuestUpdate,
    executor: Executor = db,
  ): Promise<GuestRow | null> {
    const [updated] = await executor
      .update(guests)
      .set(updates)
      .where(eq(guests.id, id))
      .returning();
    return updated ?? null;
  },

  /** By global guest UUID: atomically increment the no-show counter. */
  async incrementNoShowCount(id: string, executor: Executor = db): Promise<void> {
    await executor
      .update(guests)
      .set({ noShowCount: sql`${guests.noShowCount} + 1`, updatedAt: new Date() })
      .where(eq(guests.id, id));
  },

  /** By global guest UUID: atomically increment visit count and stamp last visit. */
  async incrementVisitCount(
    id: string,
    lastVisitDate: string,
    executor: Executor = db,
  ): Promise<void> {
    await executor
      .update(guests)
      .set({
        visitCount: sql`${guests.visitCount} + 1`,
        lastVisitDate,
        updatedAt: new Date(),
      })
      .where(eq(guests.id, id));
  },

  /**
   * By global guest UUID: atomically adjust the points balance by `delta`
   * (negative to deduct). Caller is responsible for balance checks.
   */
  async adjustPoints(id: string, delta: number, executor: Executor = db): Promise<void> {
    await executor
      .update(guests)
      .set({ pointsBalance: sql`${guests.pointsBalance} + ${delta}`, updatedAt: new Date() })
      .where(eq(guests.id, id));
  },
};
