import { eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { restaurants } from "../db/schema.js";
import type { Executor } from "./types.js";

export type RestaurantRow = InferSelectModel<typeof restaurants>;

export interface OwnerWhatsappMissingRow {
  restaurantId: string;
  slug: string;
  name: string;
  ownerPhone: string | null;
  whatsappNumber: string | null;
  phone: string | null;
  missingCount: number;
  recipientMissingCount: number;
  fallbackAvailableCount: number;
}

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

  /**
   * Restaurants missing an owner WhatsApp config, with window-function counts of
   * how many also lack any delivery recipient vs. have a fallback. Used by the
   * outbound-message delivery-readiness diagnostics.
   */
  findOwnerWhatsappMissing(
    limit: number,
    executor: Executor = db,
  ): Promise<OwnerWhatsappMissingRow[]> {
    return executor
      .select({
        restaurantId: restaurants.id,
        slug: restaurants.slug,
        name: restaurants.name,
        ownerPhone: restaurants.ownerPhone,
        whatsappNumber: restaurants.whatsappNumber,
        phone: restaurants.phone,
        missingCount: sql<number>`count(*) over()::int`,
        recipientMissingCount: sql<number>`count(*) filter (
          where (${restaurants.ownerPhone} is null or trim(${restaurants.ownerPhone}) = '')
            and (${restaurants.whatsappNumber} is null or trim(${restaurants.whatsappNumber}) = '')
            and (${restaurants.phone} is null or trim(${restaurants.phone}) = '')
        ) over()::int`,
        fallbackAvailableCount: sql<number>`count(*) filter (
          where (${restaurants.ownerPhone} is not null and trim(${restaurants.ownerPhone}) <> '')
            or (${restaurants.whatsappNumber} is not null and trim(${restaurants.whatsappNumber}) <> '')
            or (${restaurants.phone} is not null and trim(${restaurants.phone}) <> '')
        ) over()::int`,
      })
      .from(restaurants)
      .where(sql`${restaurants.ownerWhatsapp} is null or trim(${restaurants.ownerWhatsapp}) = ''`)
      .orderBy(restaurants.name)
      .limit(limit);
  },
};
