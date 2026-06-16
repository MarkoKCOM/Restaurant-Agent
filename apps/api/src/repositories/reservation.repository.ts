import { and, eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { reservations } from "../db/schema.js";
import type { Executor } from "./types.js";

export type ReservationRow = InferSelectModel<typeof reservations>;
export type ReservationInsert = InferInsertModel<typeof reservations>;
export type ReservationUpdate = Partial<
  Omit<ReservationInsert, "id" | "restaurantId" | "guestId">
>;

/**
 * Data access for the `reservations` table. Tenant scoping (`restaurantId`) is
 * applied on the by-restaurant reads; by-PK reads/writes operate on a specific
 * reservation id the caller already holds.
 */
export const reservationRepository = {
  /** Tenant-scoped: reservations for a restaurant on a date, ordered by start time. */
  findByDay(
    restaurantId: string,
    date: string,
    executor: Executor = db,
  ): Promise<ReservationRow[]> {
    return executor
      .select()
      .from(reservations)
      .where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.date, date)))
      .orderBy(reservations.timeStart);
  },

  /**
   * List with optional restaurant/date filters, ordered by date then start time.
   * With no filters this is an unscoped (super-admin) listing across restaurants.
   */
  list(
    params: { restaurantId?: string; date?: string },
    executor: Executor = db,
  ): Promise<ReservationRow[]> {
    const conditions: SQL[] = [];
    if (params.restaurantId) {
      conditions.push(eq(reservations.restaurantId, params.restaurantId));
    }
    if (params.date) {
      conditions.push(eq(reservations.date, params.date));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return executor
      .select()
      .from(reservations)
      .where(where)
      .orderBy(reservations.date, reservations.timeStart);
  },

  /** By global reservation UUID. */
  async findById(id: string, executor: Executor = db): Promise<ReservationRow | null> {
    const [row] = await executor
      .select()
      .from(reservations)
      .where(eq(reservations.id, id))
      .limit(1);
    return row ?? null;
  },

  /** Returns the created row, or null when the insert produced nothing. */
  async insert(
    values: ReservationInsert,
    executor: Executor = db,
  ): Promise<ReservationRow | null> {
    const [created] = await executor.insert(reservations).values(values).returning();
    return created ?? null;
  },

  /** By global reservation UUID. Returns the updated row, or null when none matched. */
  async updateById(
    id: string,
    updates: ReservationUpdate,
    executor: Executor = db,
  ): Promise<ReservationRow | null> {
    const [updated] = await executor
      .update(reservations)
      .set(updates)
      .where(eq(reservations.id, id))
      .returning();
    return updated ?? null;
  },
};
