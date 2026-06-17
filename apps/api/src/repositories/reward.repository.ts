import { and, eq, inArray } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { rewards } from "../db/schema.js";
import type { Executor } from "./types.js";
import { tenantScope } from "./tenant-scope.js";

export type RewardRow = InferSelectModel<typeof rewards>;
export type RewardInsert = InferInsertModel<typeof rewards>;
export type RewardUpdate = Partial<Omit<RewardInsert, "id" | "restaurantId">>;

/**
 * Data access for the `rewards` catalog. Tenant scoping (`restaurantId`) is
 * applied on the catalog reads/writes; `findActiveById` is the one redemption
 * lookup that resolves a reward by id first and lets the caller verify
 * ownership (preserving the existing redeem flow).
 */
export const rewardRepository = {
  /** Tenant-scoped: a restaurant's reward catalog (active only by default), cheapest first. */
  listByRestaurant(
    restaurantId: string,
    includeInactive = false,
    executor: Executor = db,
  ): Promise<RewardRow[]> {
    return executor
      .select()
      .from(rewards)
      .where(
        includeInactive
          ? eq(rewards.restaurantId, restaurantId)
          : and(eq(rewards.restaurantId, restaurantId), eq(rewards.isActive, true)),
      )
      .orderBy(rewards.pointsCost);
  },

  /** Tenant-scoped: a reward by id within a restaurant. */
  async findByIdInRestaurant(
    id: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<RewardRow | null> {
    const [row] = await executor
      .select()
      .from(rewards)
      .where(and(eq(rewards.id, id), eq(rewards.restaurantId, restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped by reward UUID: returns null for another tenant's id. */
  async findById(id: string, executor: Executor = db): Promise<RewardRow | null> {
    const [row] = await executor
      .select()
      .from(rewards)
      .where(and(eq(rewards.id, id), tenantScope(rewards.restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: rewards by a set of UUIDs (e.g. resolving names for a claim list). */
  findByIds(ids: string[], executor: Executor = db): Promise<RewardRow[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return executor
      .select()
      .from(rewards)
      .where(and(inArray(rewards.id, ids), tenantScope(rewards.restaurantId)));
  },

  /** An active reward by id (ownership verified by the caller). */
  async findActiveById(id: string, executor: Executor = db): Promise<RewardRow | null> {
    const [row] = await executor
      .select()
      .from(rewards)
      .where(and(eq(rewards.id, id), eq(rewards.isActive, true)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: update a reward within a restaurant. */
  async updateInRestaurant(
    id: string,
    restaurantId: string,
    updates: RewardUpdate,
    executor: Executor = db,
  ): Promise<RewardRow | null> {
    const [updated] = await executor
      .update(rewards)
      .set(updates)
      .where(and(eq(rewards.id, id), eq(rewards.restaurantId, restaurantId)))
      .returning();
    return updated ?? null;
  },

  async insert(values: RewardInsert, executor: Executor = db): Promise<RewardRow> {
    const [created] = await executor.insert(rewards).values(values).returning();
    if (!created) {
      throw new Error("Failed to create reward");
    }
    return created;
  },
};
