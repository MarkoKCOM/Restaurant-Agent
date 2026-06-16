import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { restaurants } from "../db/schema.js";
import type { Executor } from "./types.js";

export type RestaurantRow = InferSelectModel<typeof restaurants>;

/**
 * Data access for the `restaurants` table. A restaurant's own `id` is the
 * tenant root, so `findById` keys on it directly.
 */
export const restaurantRepository = {
  async findById(id: string, executor: Executor = db): Promise<RestaurantRow | null> {
    const [row] = await executor
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    return row ?? null;
  },
};
