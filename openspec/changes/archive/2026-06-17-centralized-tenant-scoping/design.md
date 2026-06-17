## Context

The data-access seam routes 100% of API DB access through `apps/api/src/repositories`. Tenant scoping is applied on by-restaurant reads, but ~14 **by-PK** methods (`findById(id)`, `updateById(id)`) carry no `restaurantId` filter. They are guarded only by a route-level **fetch-then-check**: e.g. `reservations.ts` selects the row by id, reads `restaurantId`, then calls `enforceTenant(user, restaurantId)`. The guard is correct where present but is manual and per-route — the failure mode is omission.

Key facts from the codebase that constrain the design:
- **Auth**: a global Fastify `onRequest` hook populates `request.user` ({id, email, restaurantId, role}); `super_admin` has `restaurantId: null` and selects a tenant via the `x-restaurant-id` header. `resolveRestaurantId`/`enforceTenant` live in `middleware/auth.ts`.
- **DB**: postgres-js pool (`max: 20`) + drizzle. Repositories take an `Executor` (`db | tx`); the only existing per-scope mechanism is the transaction seam. No AsyncLocalStorage or per-request connection context exists.
- **Out-of-request paths**: 4 BullMQ workers + 6 cron jobs/restaurant + the seed. They hit repositories with **no HTTP request**, but already carry an explicit `restaurantId` in job data.
- **Schema**: 14 tables are tenant-scoped (have `restaurantId`); `restaurants` and `adminUsers` are global; **`challengeProgress` has no `restaurantId`** (only `challengeId`+`guestId`).

## Goals / Non-Goals

**Goals:**
- A cross-tenant read or write is impossible for `admin`/`employee` — by construction, not convention.
- Enforcement is centralized: adding a new endpoint or repository method is tenant-safe by default.
- `super_admin` cross-tenant access is preserved via an explicit, auditable bypass.
- Behavior-preserving for correct traffic; incremental; keeps the 22 services, transactions, and 3 CI gates green.
- A deliberate cross-tenant attempt is covered by an automated test that must fail (deny).

**Non-Goals:**
- Not changing the auth/JWT model or roles.
- Not reworking `super_admin` admin console semantics.
- Not adding per-row ACLs beyond restaurant tenancy.
- Not migrating workers/crons off explicit `restaurantId` job data (they stay explicit; they just also set the context/RLS setting).

## Decisions

### Decision 1: Defense in depth — app-level tenant context AND database RLS (phased)

Adopt **both** layers, delivered in two phases:
- **Layer 1 (application, Phase 1):** an `AsyncLocalStorage`-based tenant context + tenant-aware by-PK repository methods.
- **Layer 2 (database, Phase 2):** PostgreSQL Row-Level Security as the un-bypassable backstop.

*Rationale:* The goal is "impossible, not discouraged." Only RLS makes it impossible at the database — an app-only solution can still be defeated by a hand-written query (though the seam + the `no ../db/schema` lint guard make that hard). But RLS alone is invasive and risky to land in one step, and gives worse error ergonomics (a denied row looks like "not found" with no app context). The app layer lands fast, is behavior-preserving, and immediately closes the omission risk; RLS then guarantees it at the DB. Phasing lets each layer ship green independently.

*Alternatives considered:*
- **App context only** — lighter, no DB changes, but not "impossible" (a future raw query bypasses it). Rejected as the *final* state; accepted as Phase 1.
- **RLS only** — strongest but lands as one big risky change, and the app still needs to *set* the tenant per request anyway. Rejected as a first step; adopted as Phase 2.

### Decision 2: Tenant context via `AsyncLocalStorage`, set at the edges

A `tenantContext` module exposes `runWithTenant({ restaurantId, role }, fn)` and `getTenant()`. It is entered:
- in the auth `onRequest` hook (or a thin wrapper) for HTTP requests, from `request.user`;
- in each BullMQ worker's job processor, from `job.data.restaurantId`;
- around cron-triggered service calls and the seed.

*Rationale:* `AsyncLocalStorage` propagates through async/await without threading a parameter through every call — it covers both HTTP and worker paths with one mechanism. Setting it "at the edges" (the few entry points) keeps the surface tiny. The alternative — threading a `ctx` argument through every service/repo call — was rejected as a large, noisy signature change that the seam was specifically designed to avoid.

### Decision 3: By-PK methods become tenant-scoped; `super_admin`/system use an explicit unscoped variant

Replace the unsafe `findById(id)`/`updateById(id)` with tenant-scoped behavior: they read the active `restaurantId` from the tenant context and add it to the WHERE clause (mirroring the already-shipped `table.findById(id, restaurantId)` pattern). For the legitimate cross-tenant cases (super_admin, the `table.findRestaurantIdById` bootstrap, `guest.listAll`), provide **explicitly named** unscoped methods (e.g. `findByIdUnscoped`) that are the only way to cross tenants and are easy to grep/audit.

*Rationale:* Makes the safe path the default and the unsafe path loud and rare. Routes drop their fetch-then-check (the repo enforces it), removing the omission failure mode. Consistent with the seam's "tenant filter lives in the repository" principle.

### Decision 4: RLS integration rides the existing transaction seam via `SET LOCAL`

RLS policies use `current_setting('app.current_restaurant_id', true)`. Because the connection pool reuses connections, the setting must be **transaction-scoped** (`SET LOCAL`), not session-scoped (which would leak across pooled requests). The repositories already accept a transaction executor; the tenant-context entry points wrap their DB work in a transaction that first runs `SET LOCAL app.current_restaurant_id = $1`. `super_admin`/system paths set a sentinel that a policy treats as "bypass" (or use a separate role with `BYPASSRLS`).

*Rationale:* Reuses the seam's executor/transaction support instead of inventing per-request connection management. `SET LOCAL` is pool-safe (auto-reset at transaction end). Avoids `RESET`/leak bugs that session-level `SET` would cause with a shared pool. Trade-off: tenant DB work runs inside a transaction — acceptable, and aligns with where the seam is heading (more atomic flows).

### Decision 5: `challengeProgress` policy via subquery; global tables exempt

RLS for `challengeProgress` (no `restaurantId`) uses a policy that joins/subqueries `challenges` to derive the tenant. `restaurants` and `adminUsers` are exempt (global / auth tables, guarded by role checks, not RLS).

*Rationale:* `challengeProgress` is the one tenant-scoped-by-association table; a subquery policy keeps it covered without a schema change. Adding a denormalized `restaurantId` column to it is an alternative (faster policy) but is a schema migration + backfill — deferred unless the subquery proves slow.

## Risks / Trade-offs

- **[Pool + session-var leakage]** Session-level `SET` would bleed a tenant across pooled requests → cross-tenant leak. → Mitigation: use only `SET LOCAL` inside a transaction; never session `SET`. Add a test that runs two interleaved tenants on the pool and asserts isolation.
- **[Transaction-per-request overhead]** Wrapping tenant DB work in a transaction adds slight overhead and changes failure semantics (a late error rolls back the whole request's writes). → Mitigation: acceptable for correctness; most handlers already do one logical write. Measure on the VPS; reads can use a lighter `SET LOCAL`-in-a-read-transaction.
- **[Workers/cron miss the context]** A worker that forgets to enter `runWithTenant` would hit RLS with no setting → denied (fail-closed, good) or, if app-layer only, unscoped (bad). → Mitigation: wrap worker processors centrally; fail-closed default (no setting ⇒ deny) once RLS is on.
- **[super_admin bypass is a sharp edge]** A bypass that's too broad re-opens the hole. → Mitigation: the bypass is a single explicit path (sentinel/`BYPASSRLS` role), role-checked, logged, and the only unscoped repository methods are explicitly named and audited.
- **[Behavior drift during migration]** Converting by-PK methods could change a 404-vs-403 or null-vs-throw. → Mitigation: phase per-table, keep the e2e + repo-sql-smoke gates green, and preserve route status codes.
- **[RLS makes denied rows look "not found"]** Loss of "forbidden" signal. → Mitigation: keep the app-layer enforceTenant/role checks for the right 403s; RLS is the backstop, not the primary UX.

## Migration Plan

1. **Phase 1a** — Add the `tenantContext` module + enter it in the auth hook and worker/cron processors (no behavior change yet; context is set but unused).
2. **Phase 1b** — Convert by-PK repository methods to tenant-scoped (reading the context), add explicit `*Unscoped` variants for super_admin/system, and simplify the by-id routes. Ship per-table, gates green.
3. **Phase 2a** — Add the RLS migration (policies on 14 tables + challengeProgress subquery policy; app DB role / bypass). Wire `SET LOCAL app.current_restaurant_id` into the tenant-context DB entry points. Ship behind verification first (policies permissive-then-restrictive).
4. **Phase 2b** — Flip RLS to fail-closed; add the cross-tenant-denied test (admin of A cannot read/write B; super_admin can; pool-isolation test) to the e2e gate.
5. **Rollback**: each phase is independently revertible; RLS can be disabled per-table via migration without touching app code.

## Open Questions

- Per-request transaction for **reads** too, or only writes? (Reads need `SET LOCAL` to satisfy RLS, which implies a read transaction. Confirm postgres-js overhead on the VPS.)
- `super_admin` bypass mechanism: a sentinel value the policy treats as "all" vs a dedicated `BYPASSRLS` Postgres role for the super-admin path. Which is simpler to operate on the single VPS DB user?
- Does `challengeProgress` warrant a denormalized `restaurantId` column now (simpler/faster RLS) or is the subquery policy sufficient?
- Are there any direct `db`-using paths left (diagnostics, agent-tools) that must also set the tenant setting once RLS is fail-closed? (diagnostics is read-only/admin; confirm it runs as super_admin/bypass.)
