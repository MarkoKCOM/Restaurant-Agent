import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { rewardClaims } from "../db/schema.js";
import type { Executor } from "./types.js";

export type RewardClaimRow = InferSelectModel<typeof rewardClaims>;
export type RewardClaimInsert = InferInsertModel<typeof rewardClaims>;
export type RewardClaimUpdate = Partial<
  Omit<RewardClaimInsert, "id" | "restaurantId" | "guestId">
>;

/**
 * Data access for the `rewardClaims` table. Lookups are by global UUID or by the
 * unique claim code; reads are keyed by guest for a guest's claim history.
 */
export const rewardClaimRepository = {
  /** Returns the created row, or null when the insert produced nothing. */
  async insert(values: RewardClaimInsert, executor: Executor = db): Promise<RewardClaimRow | null> {
    const [created] = await executor.insert(rewardClaims).values(values).returning();
    return created ?? null;
  },

  /** By unique claim code. */
  async findByCode(claimCode: string, executor: Executor = db): Promise<RewardClaimRow | null> {
    const [row] = await executor
      .select()
      .from(rewardClaims)
      .where(eq(rewardClaims.claimCode, claimCode))
      .limit(1);
    return row ?? null;
  },

  /** By global claim UUID. */
  async findById(id: string, executor: Executor = db): Promise<RewardClaimRow | null> {
    const [row] = await executor
      .select()
      .from(rewardClaims)
      .where(eq(rewardClaims.id, id))
      .limit(1);
    return row ?? null;
  },

  /** By global claim UUID. Returns the updated row, or null when none matched. */
  async updateById(
    id: string,
    updates: RewardClaimUpdate,
    executor: Executor = db,
  ): Promise<RewardClaimRow | null> {
    const [updated] = await executor
      .update(rewardClaims)
      .set(updates)
      .where(eq(rewardClaims.id, id))
      .returning();
    return updated ?? null;
  },

  /** By global guest UUID: a guest's claims, newest-first. */
  findByGuest(guestId: string, executor: Executor = db): Promise<RewardClaimRow[]> {
    return executor
      .select()
      .from(rewardClaims)
      .where(eq(rewardClaims.guestId, guestId))
      .orderBy(desc(rewardClaims.claimedAt));
  },

  /** Tenant-scoped: claims claimed within a date range (analytics). */
  listByRestaurantInRange(
    restaurantId: string,
    from: Date,
    to: Date,
    executor: Executor = db,
  ): Promise<RewardClaimRow[]> {
    return executor
      .select()
      .from(rewardClaims)
      .where(
        and(
          eq(rewardClaims.restaurantId, restaurantId),
          gte(rewardClaims.claimedAt, from),
          lte(rewardClaims.claimedAt, to),
        ),
      );
  },
};
