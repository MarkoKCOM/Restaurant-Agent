## Why

Multi-tenant isolation in the API is currently enforced by **convention, not by construction**. ~14 repository methods read/write by primary key with no `restaurantId` filter (`findById(id)`, `updateById(id)` on guests, reservations, rewards, reward-claims, waitlist, challenges, campaigns, engagement-jobs, visits). The only thing stopping a cross-restaurant read/write is a **manual route-level guard**: each by-id route must fetch the row, read its `restaurantId`, then call `enforceTenant`. Forget that fetch-then-check once — in a route, a service, or a future endpoint — and one restaurant can read or modify another's guests, reservations, points, or messages. This is the top remaining risk from the 2026-06-15 architecture review (item #5) and the roadmap's "Row-level security for tenant isolation". The data-access seam (now complete: all DB access goes through `apps/api/src/repositories`) makes a centralized fix possible for the first time.

## What Changes

- Introduce a **request/job-scoped tenant context** (`AsyncLocalStorage`) carrying the active `restaurantId` and role, set once by the auth middleware (and explicitly by workers/cron from job data, which run outside HTTP requests).
- Make the by-PK tenant repository methods **tenant-aware**: they require/auto-apply the active `restaurantId`, so an unscoped cross-tenant fetch becomes impossible. The fetch-then-check pattern in routes collapses into a single scoped call (consistent with the existing `table.findById(id, restaurantId)` / `reward.findByIdInRestaurant`).
- Add **PostgreSQL Row-Level Security** as the un-bypassable database backstop: RLS policies on the 14 tenant tables keyed off a per-transaction session setting (`app.current_restaurant_id`), set via the existing executor/transaction seam. Even a buggy or hand-written query cannot return another tenant's rows.
- **Preserve `super_admin`** cross-tenant access (an explicit bypass: a sentinel/`BYPASSRLS` path and the existing `x-restaurant-id` override).
- **No external behavior change** for correct requests: same routes, same responses. The only observable change is that a *cross-tenant* attempt now fails (which is the point), and a new automated test proves it.

This is **non-breaking** for legitimate traffic and is delivered **incrementally** (app-level layer first, RLS backstop second), behavior-preserving at each step, keeping the 22 migrated services, the transactions, and the 3 CI gates green.

## Capabilities

### New Capabilities
- `tenant-isolation`: Centralized, defense-in-depth enforcement that a request/job can only read or write rows belonging to its active restaurant, with an explicit `super_admin` bypass — enforced both in the application (tenant context + scoped repositories) and in the database (RLS).

### Modified Capabilities
<!-- The `data-access-layer` capability gains tenant-context behavior, but its existing requirements (repository mediation, executor-awareness, testability, behavior preservation) are unchanged. Treated as additive (new capability) rather than a delta to avoid restating them. -->

## Impact

- **New code**: a tenant-context module (`AsyncLocalStorage`), middleware wiring, worker/cron context wrapping, an RLS migration (policies + a non-superuser app DB role or `SET LOCAL` integration), and a cross-tenant-denied test added to the e2e/integration gate.
- **Modified code**: the by-PK repository methods (`findById`/`updateById` on the 14 tenant tables) gain tenant scoping; by-id routes drop their redundant fetch-then-check; the DB connection/transaction layer sets the per-request tenant setting.
- **Special cases**: `challengeProgress` has no direct `restaurantId` (RLS via a join/subquery on `challenges`); `restaurants` and `adminUsers` are global (no RLS / different policy); workers + 6 cron jobs/restaurant set context from job data.
- **Risk**: touches the DB session/transaction model and every tenant table; mitigated by phasing (app layer, then RLS), behavior-preserving migration, and a deliberate cross-tenant-access test that must fail.
- **Unblocks**: roadmap Phase 3 "Row-level security for tenant isolation".
