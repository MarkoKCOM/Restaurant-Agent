## 1. Phase 1a — Tenant context (no behavior change)

- [x] 1.1 Create `apps/api/src/context/tenant-context.ts` using `AsyncLocalStorage`: `runWithTenant({ restaurantId, role }, fn)`, `getTenant()`, `getTenantRestaurantId()` (throws/returns null per policy when unset)
- [x] 1.2 Enter the context in the auth path (wrap the `onRequest` hook or add a follow-on hook) from `request.user`; super_admin's selected `x-restaurant-id` becomes the active id (or a bypass marker)
- [x] 1.3 Enter the context in every BullMQ worker processor (reminder, summary, engagement, campaign) and cron-triggered service calls, from `job.data.restaurantId`; wrap the seed too
- [x] 1.4 Verify build/type-check/lint/tests/e2e all green with the context set-but-unused (pure addition)

## 2. Phase 1b — Tenant-scoped by-PK repositories + route simplification

- [ ] 2.1 Convert by-PK tenant reads (`findById(id)`) to derive `restaurantId` from the tenant context and filter on it; add explicit `findByIdUnscoped(id)` where a sanctioned cross-tenant read exists (super_admin, `table.findRestaurantIdById` bootstrap, `guest.listAll`)
- [ ] 2.2 Convert by-PK tenant writes (`updateById(id, ...)`) the same way; explicit `*Unscoped` variants only where justified
- [ ] 2.3 Per table, update callers (routes/services): drop the fetch-then-check; keep the route-level role checks and the correct 403/404 semantics
- [ ] 2.4 Add unit tests: a by-id read/update for a foreign-tenant id returns null / no-match (mocked context)
- [ ] 2.5 Ship per-table PRs; repo-sql-smoke + e2e green between each

## 3. Phase 2a — Database RLS (verify mode)

- [ ] 3.1 Migration: enable RLS on the 14 tenant tables; add policies `USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid)` (and a subquery policy for `challengeProgress` via `challenges`)
- [ ] 3.2 Decide + implement the super_admin/system bypass (sentinel value the policy treats as "all", or a `BYPASSRLS` role) and document it
- [ ] 3.3 Wire the tenant-context DB entry points to wrap tenant DB work in a transaction that runs `SET LOCAL app.current_restaurant_id = <id>` (reusing the executor/transaction seam); set the bypass marker for super_admin/system
- [ ] 3.4 Confirm `restaurants`/`adminUsers` remain accessible (exempt from RLS) and auth/login still works
- [ ] 3.5 Run RLS in permissive/verify mode first; full build + repo-sql-smoke + e2e green (the repo-sql-smoke job must set the tenant setting or the bypass)

## 4. Phase 2b — Fail-closed + isolation tests

- [ ] 4.1 Flip RLS to restrictive/fail-closed (no setting ⇒ deny)
- [ ] 4.2 Add an e2e cross-tenant-denied test: admin of A cannot read or modify a B-owned resource (by id, query param, header); super_admin of B can; assert denial
- [ ] 4.3 Add a pool-isolation test: two interleaved tenants on the shared pool stay isolated (proves `SET LOCAL` doesn't leak)
- [ ] 4.4 Verify all CI gates green; measure request latency impact on the VPS (transaction-per-request)

## 5. Close-out

- [ ] 5.1 Grep audit: the only cross-tenant repository methods are the explicitly named `*Unscoped` ones, and they are called only from super_admin/system paths
- [ ] 5.2 Update PROGRESS.md + ROADMAP.md (Phase 3 "Row-level security for tenant isolation" → done); note remaining open questions resolved
- [ ] 5.3 `openspec archive centralized-tenant-scoping`
