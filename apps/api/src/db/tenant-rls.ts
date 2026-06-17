import { sql } from "drizzle-orm";
import { db } from "./index.js";
import type { DbTransaction } from "./index.js";
import { getTenant } from "../context/tenant-context.js";

/**
 * The nil UUID, used as the Row-Level Security bypass sentinel. A connection
 * whose `app.current_restaurant_id` is set to this value sees/writes rows of
 * every restaurant (super_admin / system paths). No real restaurant uses the
 * nil UUID, and the RLS policies treat it specially (see 0014_tenant_rls.sql).
 */
export const BYPASS_RESTAURANT_ID = "00000000-0000-0000-0000-000000000000";

/**
 * The value to bind to `app.current_restaurant_id` for the active tenant
 * context: the restaurant's UUID for a normal request/job, or the bypass
 * sentinel for a super_admin/system bypass. Throws when there is no active
 * tenant, so a caller can never silently run unscoped under fail-closed RLS.
 */
export function tenantGucValue(): string {
  const ctx = getTenant();
  if (!ctx) {
    throw new Error("Cannot derive tenant RLS setting: no active tenant context");
  }
  if (ctx.bypass) return BYPASS_RESTAURANT_ID;
  if (!ctx.restaurantId) {
    throw new Error("Cannot derive tenant RLS setting: context has no restaurantId and is not a bypass");
  }
  return ctx.restaurantId;
}

/**
 * Set the per-transaction tenant RLS setting on `tx` via `SET LOCAL`
 * (transaction-scoped, so it never leaks across pooled connections). Must run
 * inside a transaction. Phase 2b wires this into the request/job DB entry
 * points; until RLS is FORCEd (Phase 2b) the app connects as the table owner
 * and the setting has no effect.
 */
export async function setTenantGuc(tx: DbTransaction, value = tenantGucValue()): Promise<void> {
  await tx.execute(sql`SELECT set_config('app.current_restaurant_id', ${value}, true)`);
}

/**
 * Run `fn` inside a transaction whose `app.current_restaurant_id` is set for the
 * active tenant context. The seam Phase 2b uses to make every tenant DB
 * operation satisfy RLS; provided here so it is unit-testable independently of
 * the fail-closed flip.
 */
export function runInTenantTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const value = tenantGucValue();
  return db.transaction(async (tx) => {
    await setTenantGuc(tx, value);
    return fn(tx);
  });
}
