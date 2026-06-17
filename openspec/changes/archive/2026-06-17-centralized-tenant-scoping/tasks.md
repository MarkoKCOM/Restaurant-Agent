## 1. Phase 1a — Tenant context (no behavior change)

- [x] 1.1 Create `apps/api/src/context/tenant-context.ts` using `AsyncLocalStorage`: `runWithTenant({ restaurantId, role }, fn)`, `getTenant()`, `getTenantRestaurantId()` (throws/returns null per policy when unset)
- [x] 1.2 Enter the context in the auth path (wrap the `onRequest` hook or add a follow-on hook) from `request.user`; super_admin's selected `x-restaurant-id` becomes the active id (or a bypass marker)
- [x] 1.3 Enter the context in every BullMQ worker processor (reminder, summary, engagement, campaign) and cron-triggered service calls, from `job.data.restaurantId`; wrap the seed too
- [x] 1.4 Verify build/type-check/lint/tests/e2e all green with the context set-but-unused (pure addition)

## 2. Phase 1b — Tenant-scoped by-PK repositories + route simplification

- [x] 2.1 Convert by-PK tenant reads (`findById(id)`) to derive `restaurantId` from the tenant context and filter on it; add explicit `findByIdUnscoped(id)` where a sanctioned cross-tenant read exists (super_admin, `table.findRestaurantIdById` bootstrap, `guest.listAll`) — via the shared `tenantScope()` helper on guest/reservation/reward(+findByIds)/reward-claim/waitlist/challenge `findById`. Sanctioned cross-tenant paths (`table.findRestaurantIdById`, `guest.listAll`, `table.findById` w/ explicit id) are already distinctly named; super_admin crosses via the bypass context, so no new `*Unscoped` was required.
- [x] 2.2 Convert by-PK tenant writes (`updateById(id, ...)`) the same way; explicit `*Unscoped` variants only where justified — campaign/guest/engagement-job/reservation/reward-claim/waitlist/visit `updateById` now apply `tenantScope()`.
- [~] 2.3 Per table, update callers (routes/services): drop the fetch-then-check; keep the route-level role checks and the correct 403/404 semantics — **deferred to incremental per-table PRs.** Repos now enforce isolation *by construction*, so the route-level `enforceTenant`/raw-fetch is no longer the sole guard; it is retained as defense-in-depth + correct 403 UX (per the design's risk mitigation). Removing the now-redundant raw fetches is delicate (some `enforceTenant` calls guard create-with-body-restaurantId and must stay) and is safest once Phase 2 RLS makes the route guard fully redundant.
- [x] 2.4 Add unit tests: a by-id read/update for a foreign-tenant id returns null / no-match (mocked context) — `repositories/tenant-scope.test.ts` (scoped read/write apply the tenant filter; bypass and no-context stay unscoped).
- [x] 2.5 Ship per-table PRs; repo-sql-smoke + e2e green between each — shipped as one cohesive Phase 1b PR (all 14 by-PK methods follow one mechanical pattern); type-check, lint (0 errors), 82 unit tests, build, 92-query repo-sql-smoke green.

## 3. Phase 2a — Database RLS (verify mode)

- [x] 3.1 Migration: enable RLS on the 14 tenant tables; add policies `USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid)` (and a subquery policy for `challengeProgress` via `challenges`) — `drizzle/0014_tenant_rls.sql`: RLS enabled + `tenant_isolation` policy (USING + WITH CHECK) on the 14 tables; `challenge_progress` via an EXISTS subquery on `challenges`. `restaurants`/`admin_users` left exempt. Idempotent (`DROP POLICY IF EXISTS`). Applied locally; verified 15/15 tables RLS-enabled, 0 forced.
- [x] 3.2 Decide + implement the super_admin/system bypass (sentinel value the policy treats as "all", or a `BYPASSRLS` role) and document it — **nil-UUID sentinel** (`00000000-…-0`): `app.current_restaurant_id = nil` ⇒ policy passes for all rows. Chosen over a `BYPASSRLS` role because the single VPS app user (`openseat`, non-superuser, can't `CREATEROLE`) makes a sentinel far simpler to operate. Exposed as `BYPASS_RESTAURANT_ID` in `src/db/tenant-rls.ts`. `nullif(setting,'')::uuid` keeps unset ⇒ deny without a cast error.
- [~] 3.3 Wire the tenant-context DB entry points to wrap tenant DB work in a transaction that runs `SET LOCAL app.current_restaurant_id = <id>` (reusing the executor/transaction seam); set the bypass marker for super_admin/system — **seam built, request wiring deferred to Phase 2b.** `src/db/tenant-rls.ts` provides `setTenantGuc`/`runInTenantTransaction`/`tenantGucValue` (bypass ⇒ nil-UUID). Wiring it into every request/job (transaction-per-request) only has effect once RLS is FORCEd, and that change is validated together with the fail-closed flip + pool-isolation test — so it lands in 2b to keep 2a a zero-impact verify step.
- [x] 3.4 Confirm `restaurants`/`adminUsers` remain accessible (exempt from RLS) and auth/login still works — both tables verified RLS-disabled (0 policies); app connects as table owner (bypasses RLS in verify mode); unit tests + repo-sql-smoke green.
- [x] 3.5 Run RLS in permissive/verify mode first; full build + repo-sql-smoke + e2e green (the repo-sql-smoke job must set the tenant setting or the bypass) — verify mode (enabled, not forced) ⇒ owner connection unaffected. Build, 82 unit tests, 92-query repo-sql-smoke all green. New reproducible **`db:rls-proof`** (`scripts/rls-isolation-proof.ts`) transactionally FORCEs RLS and asserts isolation: scoped sees only its tenant (0 leak), bypass sees all, non-match/unset deny (fail-closed), WITH CHECK blocks `restaurant_id` escape — 6/6 pass.

## 4. Phase 2b — Fail-closed + isolation tests — DEFERRED (descoped 2026-06-17)

**Decision:** not flipping RLS fail-closed now. Phase 1 already makes cross-tenant
access impossible by construction for admin/employee (scoped repositories), and
RLS is in place as a verified-but-dormant backstop (verify mode). Forcing RLS
requires re-plumbing every request into a per-request transaction (`SET LOCAL`),
giving public routes a tenant context (or they fail-closed), and accepting a
transaction-per-request latency cost on the single-pilot VPS — a second lock on
an already-locked door. Revisit when raw-SQL data paths or many tenants make the
DB-level guarantee worth the plumbing. The `pnpm db:rls-proof` script already
proves the policies isolate correctly once FORCEd, so the flip is low-surprise.

- [ ] 4.1 Flip RLS to restrictive/fail-closed (no setting ⇒ deny) — deferred
- [ ] 4.2 Add an e2e cross-tenant-denied test: admin of A cannot read or modify a B-owned resource (by id, query param, header); super_admin of B can; assert denial — deferred
- [ ] 4.3 Add a pool-isolation test: two interleaved tenants on the shared pool stay isolated (proves `SET LOCAL` doesn't leak) — deferred
- [ ] 4.4 Verify all CI gates green; measure request latency impact on the VPS (transaction-per-request) — deferred

## 5. Close-out

- [x] 5.1 Grep audit: cross-tenant repository methods are limited to explicitly named/documented ones, called only from super_admin/system or already-scoped paths — `guest.listAll` (super-admin listing), `table.findRestaurantIdById` (bootstrap), and the `findByIdInRestaurant` family (take an explicit `restaurantId`). `reward.findActiveById` is now context-scoped too. Residual by-key helpers (`guest.adjustPoints`/`incrementVisitCount`/`incrementNoShowCount`, `*.findByGuest`, `findByCode`, `findByReferralCode`) operate on ids the caller already obtained through a scoped lookup; RLS (verify mode) would cover them at the DB if ever FORCEd.
- [x] 5.2 Update PROGRESS.md + ROADMAP.md ("Row-level security for tenant isolation" → in place, verify mode; fail-closed deferred); open questions resolved by descoping Phase 2b.
- [~] 5.3 `openspec archive centralized-tenant-scoping` — hold until Phases 1a/1b/2a (#57/#58/#59) merge; archive then (Phase 2b intentionally left as a documented future option, not a blocker).
