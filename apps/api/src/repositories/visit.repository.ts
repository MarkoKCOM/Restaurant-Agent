import { desc, eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { visitLogs } from "../db/schema.js";
import type { Executor } from "./types.js";

export type VisitLogRow = InferSelectModel<typeof visitLogs>;
export type VisitLogInsert = InferInsertModel<typeof visitLogs>;

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
