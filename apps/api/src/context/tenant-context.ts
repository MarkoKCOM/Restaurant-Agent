import { AsyncLocalStorage } from "node:async_hooks";
import type { AdminRole } from "../middleware/auth.js";

/**
 * The active tenant for the current request or job.
 *
 * `restaurantId` is the restaurant whose data the current execution is allowed
 * to touch. `bypass` is set only for `super_admin`/system paths that are
 * permitted to cross tenants (e.g. a super_admin acting with no specific
 * restaurant selected); when `bypass` is true, tenant scoping is intentionally
 * not applied and the caller is responsible for any access control.
 */
export interface TenantContext {
  restaurantId: string | null;
  role: AdminRole | "system";
  bypass: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Run `fn` with the given tenant context active. The context propagates through
 * all async work started within `fn` via `AsyncLocalStorage`, so repositories
 * and services can read it without threading a parameter through every call.
 */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Set the tenant context for the remainder of the current async execution
 * without nesting a callback. Used by the HTTP auth hook, where the context
 * must outlive the hook and stay active through the route handler — `run`'s
 * callback would end before the handler runs, so `enterWith` is required.
 */
export function enterTenant(context: TenantContext): void {
  storage.enterWith(context);
}

/** Return the active tenant context, or `undefined` when none is set. */
export function getTenant(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Return the active tenant's `restaurantId`.
 *
 * Returns `null` when no context is set or when the context is a cross-tenant
 * bypass (super_admin/system). Tenant-scoped repository methods treat a `null`
 * result as "no active tenant" and behave per their own policy (e.g. return no
 * rows for a normal scoped read). Callers that require a concrete tenant should
 * use {@link requireTenantRestaurantId}.
 */
export function getTenantRestaurantId(): string | null {
  const context = storage.getStore();
  if (!context || context.bypass) return null;
  return context.restaurantId;
}

/**
 * Return the active tenant's `restaurantId`, throwing when there is no active
 * non-bypass tenant. Use where a concrete tenant is mandatory and its absence
 * is a programming error rather than an expected cross-tenant path.
 */
export function requireTenantRestaurantId(): string {
  const restaurantId = getTenantRestaurantId();
  if (!restaurantId) {
    throw new Error("No active tenant restaurant in context");
  }
  return restaurantId;
}
