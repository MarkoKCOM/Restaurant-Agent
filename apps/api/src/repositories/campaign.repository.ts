import { and, eq, gte, lte, ne } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { campaigns } from "../db/schema.js";
import type { Executor } from "./types.js";

export type CampaignRow = InferSelectModel<typeof campaigns>;
export type CampaignInsert = InferInsertModel<typeof campaigns>;
export type CampaignUpdate = Partial<Omit<CampaignInsert, "id" | "restaurantId">>;

/**
 * Data access for the `campaigns` table. Tenant scoping (`restaurantId`) is
 * applied on the restaurant-scoped reads; by-PK update operates on a specific
 * campaign id the caller already verified.
 */
export const campaignRepository = {
  async insert(values: CampaignInsert, executor: Executor = db): Promise<CampaignRow> {
    const [created] = await executor.insert(campaigns).values(values).returning();
    if (!created) {
      throw new Error("Failed to create campaign");
    }
    return created;
  },

  /** Tenant-scoped: a campaign by id within a restaurant. */
  async findByIdInRestaurant(
    id: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<CampaignRow | null> {
    const [row] = await executor
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.restaurantId, restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: a restaurant's other campaigns (used for cross-campaign rate limiting). */
  listByRestaurantExcluding(
    restaurantId: string,
    excludeId: string,
    executor: Executor = db,
  ): Promise<CampaignRow[]> {
    return executor
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.restaurantId, restaurantId), ne(campaigns.id, excludeId)));
  },

  /**
   * Tenant-scoped analytics selection: a specific campaign by id, or all of a
   * restaurant's campaigns created within a date range.
   */
  listForAnalytics(
    restaurantId: string,
    opts: { campaignId?: string; from: Date; to: Date },
    executor: Executor = db,
  ): Promise<CampaignRow[]> {
    const where = opts.campaignId
      ? and(eq(campaigns.restaurantId, restaurantId), eq(campaigns.id, opts.campaignId))
      : and(
          eq(campaigns.restaurantId, restaurantId),
          gte(campaigns.createdAt, opts.from),
          lte(campaigns.createdAt, opts.to),
        );
    return executor.select().from(campaigns).where(where);
  },

  /** By global campaign UUID. Returns the updated row, or null when none matched. */
  async updateById(
    id: string,
    updates: CampaignUpdate,
    executor: Executor = db,
  ): Promise<CampaignRow | null> {
    const [updated] = await executor
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id))
      .returning();
    return updated ?? null;
  },
};
