import { and, desc, eq, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { membershipProcessingFailures } from "../db/schema.js";
import type { Executor } from "./types.js";

export type MembershipProcessingFailureRow = InferSelectModel<typeof membershipProcessingFailures>;
export type MembershipProcessingFailureInsert = InferInsertModel<typeof membershipProcessingFailures>;

export interface RetryErrorDetails {
  errorName: string;
  errorCode: string | null;
  errorMessage: string;
}

/**
 * Data access for the `membershipProcessingFailures` table — the dead-letter
 * record for visit-completion post-processing stages.
 */
export const membershipProcessingFailureRepository = {
  async insert(
    values: MembershipProcessingFailureInsert,
    executor: Executor = db,
  ): Promise<MembershipProcessingFailureRow> {
    const [created] = await executor
      .insert(membershipProcessingFailures)
      .values(values)
      .returning();
    if (!created) {
      throw new Error("Failed to record membership processing failure");
    }
    return created;
  },

  /** Tenant-scoped list with optional status filter, newest-first. */
  list(
    params: { restaurantId: string; status?: "open" | "resolved"; limit?: number },
    executor: Executor = db,
  ): Promise<MembershipProcessingFailureRow[]> {
    const conditions = [eq(membershipProcessingFailures.restaurantId, params.restaurantId)];
    if (params.status) {
      conditions.push(eq(membershipProcessingFailures.status, params.status));
    }
    return executor
      .select()
      .from(membershipProcessingFailures)
      .where(and(...conditions))
      .orderBy(desc(membershipProcessingFailures.createdAt))
      .limit(params.limit ?? 50);
  },

  /** Tenant-scoped: a failure by id within a restaurant. */
  async findByIdInRestaurant(
    id: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<MembershipProcessingFailureRow | null> {
    const [row] = await executor
      .select()
      .from(membershipProcessingFailures)
      .where(
        and(
          eq(membershipProcessingFailures.id, id),
          eq(membershipProcessingFailures.restaurantId, restaurantId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** Mark a failure resolved. */
  async markResolved(
    id: string,
    executor: Executor = db,
  ): Promise<MembershipProcessingFailureRow | null> {
    const now = new Date();
    const [updated] = await executor
      .update(membershipProcessingFailures)
      .set({ status: "resolved", resolvedAt: now, lastAttemptAt: now, updatedAt: now })
      .where(eq(membershipProcessingFailures.id, id))
      .returning();
    return updated ?? null;
  },

  /** Record a failed retry: bump attempts and store the latest error. */
  async markRetryFailed(
    id: string,
    details: RetryErrorDetails,
    executor: Executor = db,
  ): Promise<MembershipProcessingFailureRow | null> {
    const now = new Date();
    const [updated] = await executor
      .update(membershipProcessingFailures)
      .set({
        ...details,
        attempts: sql`${membershipProcessingFailures.attempts} + 1`,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(eq(membershipProcessingFailures.id, id))
      .returning();
    return updated ?? null;
  },
};
