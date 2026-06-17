import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests } from "../db/schema.js";
import type { Executor } from "./types.js";
import { tenantScope } from "./tenant-scope.js";

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

  /** Tenant-scoped: guests for a restaurant ordered by most recent visit first. */
  listByRestaurantRecentFirst(restaurantId: string, executor: Executor = db): Promise<GuestRow[]> {
    return executor
      .select()
      .from(guests)
      .where(eq(guests.restaurantId, restaurantId))
      .orderBy(desc(guests.lastVisitDate), desc(guests.createdAt));
  },

  /** Unscoped: super-admin listing across every restaurant. */
  listAll(executor: Executor = db): Promise<GuestRow[]> {
    return executor.select().from(guests);
  },

  /**
   * Tenant-scoped: guests whose last visit is on/before `notAfter`, and (when
   * `after` is given) strictly after it — i.e. lapsed within a date window.
   */
  listLapsedInWindow(
    restaurantId: string,
    notAfter: string,
    after: string | undefined,
    executor: Executor = db,
  ): Promise<GuestRow[]> {
    const conditions = [
      eq(guests.restaurantId, restaurantId),
      lte(guests.lastVisitDate, notAfter),
    ];
    if (after) {
      conditions.push(gt(guests.lastVisitDate, after));
    }
    return executor.select().from(guests).where(and(...conditions));
  },

  /** Tenant-scoped by guest UUID: returns null for another tenant's id. */
  async findById(id: string, executor: Executor = db): Promise<GuestRow | null> {
    const [row] = await executor
      .select()
      .from(guests)
      .where(and(eq(guests.id, id), tenantScope(guests.restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /** By unique referral code (referrer lookup / uniqueness check). */
  async findByReferralCode(code: string, executor: Executor = db): Promise<GuestRow | null> {
    const [row] = await executor
      .select()
      .from(guests)
      .where(eq(guests.referralCode, code))
      .limit(1);
    return row ?? null;
  },

  /** All guests referred by a given referrer guest. */
  findByReferredBy(referrerId: string, executor: Executor = db): Promise<GuestRow[]> {
    return executor.select().from(guests).where(eq(guests.referredBy, referrerId));
  },

  async insert(values: GuestInsert, executor: Executor = db): Promise<GuestRow> {
    const [created] = await executor.insert(guests).values(values).returning();
    if (!created) {
      throw new Error("Failed to create guest");
    }
    return created;
  },

  /** Tenant-scoped by guest UUID. Returns the updated row, or null when none matched (incl. another tenant's id). */
  async updateById(
    id: string,
    updates: GuestUpdate,
    executor: Executor = db,
  ): Promise<GuestRow | null> {
    const [updated] = await executor
      .update(guests)
      .set(updates)
      .where(and(eq(guests.id, id), tenantScope(guests.restaurantId)))
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
