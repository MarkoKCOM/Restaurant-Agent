import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { visitLogs } from "../db/schema.js";
import type { Executor } from "./types.js";

export type VisitLogRow = InferSelectModel<typeof visitLogs>;
export type VisitLogInsert = InferInsertModel<typeof visitLogs>;
export type VisitLogUpdate = Partial<
  Omit<VisitLogInsert, "id" | "restaurantId" | "guestId">
>;

/**
 * Data access for the `visitLogs` table. Reads are keyed by the guest's global
 * UUID (the caller already holds it); all visit history is newest-first.
 */
export const visitRepository = {
  /** Returns the created row, or null when the insert produced nothing. */
  async insert(values: VisitLogInsert, executor: Executor = db): Promise<VisitLogRow | null> {
    const [created] = await executor.insert(visitLogs).values(values).returning();
    return created ?? null;
  },

  /** Tenant-scoped: all visit logs for a restaurant (e.g. campaign spend aggregation). */
  findByRestaurant(restaurantId: string, executor: Executor = db): Promise<VisitLogRow[]> {
    return executor.select().from(visitLogs).where(eq(visitLogs.restaurantId, restaurantId));
  },

  /** A visit log for a specific guest reservation, if one exists. */
  async findByGuestReservation(
    guestId: string,
    reservationId: string,
    executor: Executor = db,
  ): Promise<VisitLogRow | null> {
    const [row] = await executor
      .select()
      .from(visitLogs)
      .where(
        and(eq(visitLogs.guestId, guestId), eq(visitLogs.reservationId, reservationId)),
      )
      .limit(1);
    return row ?? null;
  },

  /** By global visit-log UUID. Returns the updated row, or null when none matched. */
  async updateById(
    id: string,
    updates: VisitLogUpdate,
    executor: Executor = db,
  ): Promise<VisitLogRow | null> {
    const [updated] = await executor
      .update(visitLogs)
      .set(updates)
      .where(eq(visitLogs.id, id))
      .returning();
    return updated ?? null;
  },

  /** Tenant-scoped: visit logs for a restaurant within an optional date range, newest-first. */
  listByRestaurantInDateRange(
    restaurantId: string,
    from: string | undefined,
    to: string | undefined,
    executor: Executor = db,
  ): Promise<VisitLogRow[]> {
    const conditions = [eq(visitLogs.restaurantId, restaurantId)];
    if (from) conditions.push(gte(visitLogs.date, from));
    if (to) conditions.push(lte(visitLogs.date, to));
    return executor
      .select()
      .from(visitLogs)
      .where(and(...conditions))
      .orderBy(desc(visitLogs.date));
  },

  /** By global guest UUID: rated visit logs only, newest-first. */
  listRatedByGuest(guestId: string, executor: Executor = db): Promise<VisitLogRow[]> {
    return executor
      .select()
      .from(visitLogs)
      .where(and(eq(visitLogs.guestId, guestId), sql`${visitLogs.rating} IS NOT NULL`))
      .orderBy(desc(visitLogs.date));
  },

  /** A positive-sentiment visit log for a specific guest reservation, if one exists. */
  async findPositiveForReservation(
    guestId: string,
    restaurantId: string,
    reservationId: string,
    executor: Executor = db,
  ): Promise<VisitLogRow | null> {
    const [row] = await executor
      .select()
      .from(visitLogs)
      .where(
        and(
          eq(visitLogs.guestId, guestId),
          eq(visitLogs.restaurantId, restaurantId),
          eq(visitLogs.reservationId, reservationId),
          eq(visitLogs.sentiment, "positive"),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** By global guest UUID: visit logs newest-first, optionally limited. */
  findByGuest(
    guestId: string,
    options: { limit?: number } = {},
    executor: Executor = db,
  ): Promise<VisitLogRow[]> {
    const base = executor
      .select()
      .from(visitLogs)
      .where(eq(visitLogs.guestId, guestId))
      .orderBy(desc(visitLogs.date));
    return options.limit != null ? base.limit(options.limit) : base;
  },
};
