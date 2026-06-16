import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { engagementJobs } from "../db/schema.js";
import type { Executor } from "./types.js";

export type EngagementJobRow = InferSelectModel<typeof engagementJobs>;
export type EngagementJobInsert = InferInsertModel<typeof engagementJobs>;
export type EngagementJobUpdate = Partial<
  Omit<EngagementJobInsert, "id" | "restaurantId" | "guestId">
>;

/**
 * Data access for the `engagementJobs` table. Centralizes the dedup / pacing
 * lookups the engagement scheduler relies on (per-type pending, any-status,
 * windowed, and promotional-count queries), preserving their exact filters.
 */
export const engagementJobRepository = {
  async insert(values: EngagementJobInsert, executor: Executor = db): Promise<EngagementJobRow> {
    const [created] = await executor.insert(engagementJobs).values(values).returning();
    if (!created) {
      throw new Error("Failed to create engagement job");
    }
    return created;
  },

  /** A pending job of a given type for the guest/restaurant, if one exists. */
  async findPending(
    guestId: string,
    restaurantId: string,
    type: string,
    executor: Executor = db,
  ): Promise<EngagementJobRow | undefined> {
    const [row] = await executor
      .select()
      .from(engagementJobs)
      .where(
        and(
          eq(engagementJobs.guestId, guestId),
          eq(engagementJobs.restaurantId, restaurantId),
          eq(engagementJobs.type, type),
          eq(engagementJobs.status, "pending"),
        ),
      )
      .limit(1);
    return row;
  },

  /** Any job (any status) of a given type for the guest/restaurant. */
  async findAny(
    guestId: string,
    restaurantId: string,
    type: string,
    executor: Executor = db,
  ): Promise<EngagementJobRow | undefined> {
    const [row] = await executor
      .select()
      .from(engagementJobs)
      .where(
        and(
          eq(engagementJobs.guestId, guestId),
          eq(engagementJobs.restaurantId, restaurantId),
          eq(engagementJobs.type, type),
        ),
      )
      .limit(1);
    return row;
  },

  /** A job of a given type whose triggerAt falls in [windowStart, windowEnd). */
  async findInWindow(
    params: {
      guestId: string;
      restaurantId: string;
      type: string;
      windowStart: Date;
      windowEnd: Date;
    },
    executor: Executor = db,
  ): Promise<EngagementJobRow | undefined> {
    const [row] = await executor
      .select()
      .from(engagementJobs)
      .where(
        and(
          eq(engagementJobs.guestId, params.guestId),
          eq(engagementJobs.restaurantId, params.restaurantId),
          eq(engagementJobs.type, params.type),
          gte(engagementJobs.triggerAt, params.windowStart),
          lt(engagementJobs.triggerAt, params.windowEnd),
        ),
      )
      .limit(1);
    return row;
  },

  /** Count promotional pending/sent jobs in a window (optionally excluding one job). */
  async countPromotionalInWindow(
    params: {
      guestId: string;
      restaurantId: string;
      windowStart: Date;
      windowEnd: Date;
      excludeJobId?: string;
    },
    executor: Executor = db,
  ): Promise<number> {
    const conditions = [
      eq(engagementJobs.guestId, params.guestId),
      eq(engagementJobs.restaurantId, params.restaurantId),
      eq(engagementJobs.messageCategory, "promotional"),
      inArray(engagementJobs.status, ["pending", "sent"]),
      gte(engagementJobs.triggerAt, params.windowStart),
      lt(engagementJobs.triggerAt, params.windowEnd),
    ];
    if (params.excludeJobId) {
      conditions.push(ne(engagementJobs.id, params.excludeJobId));
    }
    const [result] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(engagementJobs)
      .where(and(...conditions));
    return result?.count ?? 0;
  },

  /** Skip all pending jobs of a type for the guest/restaurant; returns the count skipped. */
  async skipPending(
    guestId: string,
    restaurantId: string,
    type: string,
    reason: string,
    executor: Executor = db,
  ): Promise<number> {
    const skipped = await executor
      .update(engagementJobs)
      .set({ status: "skipped", skipReason: reason })
      .where(
        and(
          eq(engagementJobs.guestId, guestId),
          eq(engagementJobs.restaurantId, restaurantId),
          eq(engagementJobs.type, type),
          eq(engagementJobs.status, "pending"),
        ),
      )
      .returning({ id: engagementJobs.id });
    return skipped.length;
  },

  /** By global job UUID. Returns the updated row, or null when none matched. */
  async updateById(
    id: string,
    updates: EngagementJobUpdate,
    executor: Executor = db,
  ): Promise<EngagementJobRow | null> {
    const [updated] = await executor
      .update(engagementJobs)
      .set(updates)
      .where(eq(engagementJobs.id, id))
      .returning();
    return updated ?? null;
  },

  /** Tenant-scoped list with optional guest/status/category filters, ordered by triggerAt. */
  list(
    params: {
      restaurantId: string;
      guestId?: string;
      status?: string;
      messageCategory?: string;
      limit?: number;
    },
    executor: Executor = db,
  ): Promise<EngagementJobRow[]> {
    const conditions = [eq(engagementJobs.restaurantId, params.restaurantId)];
    if (params.guestId) {
      conditions.push(eq(engagementJobs.guestId, params.guestId));
    }
    if (params.status) {
      conditions.push(eq(engagementJobs.status, params.status));
    }
    if (params.messageCategory) {
      conditions.push(eq(engagementJobs.messageCategory, params.messageCategory));
    }
    const query = executor
      .select()
      .from(engagementJobs)
      .where(and(...conditions))
      .orderBy(engagementJobs.triggerAt);
    if (params.limit === undefined) {
      return query;
    }
    return query.limit(Math.min(Math.max(params.limit, 1), 200));
  },
};
