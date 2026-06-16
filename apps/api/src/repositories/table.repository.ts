import { and, eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { tables } from "../db/schema.js";
import type { Executor } from "./types.js";

export type TableRow = InferSelectModel<typeof tables>;
export type TableInsert = InferInsertModel<typeof tables>;
export type TableUpdate = Partial<Omit<TableInsert, "id" | "restaurantId">>;

/**
 * Data access for the `tables` table. Tenant scoping (`restaurantId`) is applied
 * here, in one place, on every read/update/delete — services never hand-write
 * the `eq(tables.restaurantId, ...)` filter. Methods that span tenants are
 * marked explicitly as unscoped.
 */
export const tableRepository = {
  findActiveByRestaurant(
    restaurantId: string,
    executor: Executor = db,
  ): Promise<TableRow[]> {
    return executor
      .select()
      .from(tables)
      .where(and(eq(tables.restaurantId, restaurantId), eq(tables.isActive, true)));
  },

  findByRestaurant(
    restaurantId: string,
    options: { includeInactive?: boolean } = {},
    executor: Executor = db,
  ): Promise<TableRow[]> {
    const filter = options.includeInactive
      ? eq(tables.restaurantId, restaurantId)
      : and(eq(tables.restaurantId, restaurantId), eq(tables.isActive, true));
    return executor.select().from(tables).where(filter);
  },

  /** Unscoped: super-admin listing across every restaurant. */
  findAll(
    options: { includeInactive?: boolean } = {},
    executor: Executor = db,
  ): Promise<TableRow[]> {
    if (options.includeInactive) {
      return executor.select().from(tables);
    }
    return executor.select().from(tables).where(eq(tables.isActive, true));
  },

  async findById(
    id: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<TableRow | null> {
    const [row] = await executor
      .select()
      .from(tables)
      .where(and(eq(tables.id, id), eq(tables.restaurantId, restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /**
   * Unscoped bootstrap lookup: resolves the owning restaurant for a table id so
   * the route layer can run its tenant check before the caller has a
   * `restaurantId`. Returns null when the table does not exist.
   */
  async findRestaurantIdById(
    id: string,
    executor: Executor = db,
  ): Promise<string | null> {
    const [row] = await executor
      .select({ restaurantId: tables.restaurantId })
      .from(tables)
      .where(eq(tables.id, id))
      .limit(1);
    return row?.restaurantId ?? null;
  },

  async insert(values: TableInsert, executor: Executor = db): Promise<TableRow> {
    const [created] = await executor.insert(tables).values(values).returning();
    if (!created) {
      throw new Error("Failed to create table");
    }
    return created;
  },

  async update(
    id: string,
    restaurantId: string,
    updates: TableUpdate,
    executor: Executor = db,
  ): Promise<TableRow | null> {
    const [updated] = await executor
      .update(tables)
      .set(updates)
      .where(and(eq(tables.id, id), eq(tables.restaurantId, restaurantId)))
      .returning();
    return updated ?? null;
  },

  async deactivate(
    id: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<void> {
    await executor
      .update(tables)
      .set({ isActive: false })
      .where(and(eq(tables.id, id), eq(tables.restaurantId, restaurantId)));
  },
};
