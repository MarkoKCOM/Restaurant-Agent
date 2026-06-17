import { and, eq, lte } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { waitlist } from "../db/schema.js";
import type { Executor } from "./types.js";
import { tenantScope } from "./tenant-scope.js";

export type WaitlistRow = InferSelectModel<typeof waitlist>;
export type WaitlistInsert = InferInsertModel<typeof waitlist>;
export type WaitlistUpdate = Partial<
  Omit<WaitlistInsert, "id" | "restaurantId" | "guestId">
>;

/**
 * Data access for the `waitlist` table. Tenant scoping (`restaurantId`) is
 * applied on the by-restaurant reads; by-PK reads/writes operate on a specific
 * waitlist id the caller already holds.
 */
export const waitlistRepository = {
  /** Returns the created row, or null when the insert produced nothing. */
  async insert(values: WaitlistInsert, executor: Executor = db): Promise<WaitlistRow | null> {
    const [created] = await executor.insert(waitlist).values(values).returning();
    return created ?? null;
  },

  /** Tenant-scoped: waitlist entries for a restaurant (optionally a date), oldest first. */
  listByRestaurant(
    restaurantId: string,
    date?: string,
    executor: Executor = db,
  ): Promise<WaitlistRow[]> {
    const conditions = [eq(waitlist.restaurantId, restaurantId)];
    if (date) {
      conditions.push(eq(waitlist.date, date));
    }
    return executor
      .select()
      .from(waitlist)
      .where(and(...conditions))
      .orderBy(waitlist.createdAt);
  },

  /** Tenant-scoped: still-waiting entries for a restaurant on a date, oldest first. */
  findWaitingForDay(
    restaurantId: string,
    date: string,
    executor: Executor = db,
  ): Promise<WaitlistRow[]> {
    return executor
      .select()
      .from(waitlist)
      .where(
        and(
          eq(waitlist.restaurantId, restaurantId),
          eq(waitlist.date, date),
          eq(waitlist.status, "waiting"),
        ),
      )
      .orderBy(waitlist.createdAt);
  },

  /** Tenant-scoped by waitlist UUID: returns null for another tenant's id. */
  async findById(id: string, executor: Executor = db): Promise<WaitlistRow | null> {
    const [row] = await executor
      .select()
      .from(waitlist)
      .where(and(eq(waitlist.id, id), tenantScope(waitlist.restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped by waitlist UUID. Returns the updated row, or null when none matched (incl. another tenant's id). */
  async updateById(
    id: string,
    updates: WaitlistUpdate,
    executor: Executor = db,
  ): Promise<WaitlistRow | null> {
    const [updated] = await executor
      .update(waitlist)
      .set(updates)
      .where(and(eq(waitlist.id, id), tenantScope(waitlist.restaurantId)))
      .returning();
    return updated ?? null;
  },

  /** Bulk-expire offered entries past their expiry; returns the number expired. */
  async expireOffersBefore(cutoff: Date, executor: Executor = db): Promise<number> {
    const result = await executor
      .update(waitlist)
      .set({ status: "expired" })
      .where(and(eq(waitlist.status, "offered"), lte(waitlist.expiresAt, cutoff)))
      .returning();
    return result.length;
  },
};
