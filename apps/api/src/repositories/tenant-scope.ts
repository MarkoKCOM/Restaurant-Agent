import { eq } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import { getTenantRestaurantId } from "../context/tenant-context.js";

/**
 * Build the active-tenant filter for a table's `restaurantId` column.
 *
 * Returns `eq(column, <active restaurantId>)` when a concrete tenant is in
 * scope, or `undefined` when the context is a cross-tenant bypass
 * (super_admin/system) or unset. The result is meant to be composed into an
 * `and(...)` next to a by-PK predicate; drizzle's `and` drops the `undefined`,
 * so a bypass/unset context leaves the by-PK query unscoped while a normal
 * request/job is pinned to its own restaurant.
 *
 * Effect: a by-id read or write issued by a request scoped to restaurant A
 * cannot touch a row owned by restaurant B (it matches no row), without the
 * caller having to thread `restaurantId` through every call.
 */
export function tenantScope(column: AnyColumn): SQL | undefined {
  const restaurantId = getTenantRestaurantId();
  return restaurantId ? eq(column, restaurantId) : undefined;
}
