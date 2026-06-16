## Context

The API in `apps/api/src` follows a clean functional architecture: plain async service functions import the Drizzle `db` singleton (`apps/api/src/db/index.ts` exports `db` and `type DB`) and build queries inline with `db.select().from(table).where(and(eq(table.restaurantId, ...), ...))`. Tenant scoping is enforced twice: once at the route via `enforceTenant`/`resolveRestaurantId` (`apps/api/src/middleware/auth.ts`), and again inside every query via a hand-written `eq(table.restaurantId, ...)`. There are **86** such inline filters across **24** service files.

Two structural costs follow from this:
- **Untestable services.** Services bind to the concrete `db` import, so unit tests need a live PostgreSQL. The Vitest foundation (#27) currently only covers `@openseat/domain`.
- **No transaction composability.** Only one `db.transaction` exists (signup, `apps/api/src/routes/auth.ts`). Multi-write flows (e.g. visit completion touching guests + visit logs + loyalty) run as separate autocommitted statements because services have no clean way to thread a `tx` through their queries.

Services are plain functions (not classes), routes import and call them directly, and `restaurantId` already arrives as an explicit argument or on an input object. The Drizzle schema exports ~17 tables (`restaurants`, `adminUsers`, `tables`, `guests`, `reservations`, `waitlist`, `conversations`, `loyaltyTransactions`, `rewards`, `campaigns`, `engagementJobs`, `challenges`, `visitLogs`, `challengeProgress`, `rewardClaims`, `membershipProcessingFailures`, `outboundMessages`).

## Goals / Non-Goals

**Goals:**
- A repository module per table under `apps/api/src/repositories/`, with intent-named methods.
- Tenant scoping enforced in exactly one place per table (the repository), eliminating the 86 inline filters.
- Every repository method accepts an executor (`db | tx`) so services can compose calls in a transaction.
- Services become unit-testable by injecting a fake repository; prove it with at least one mocked-repository service test.
- Incremental, behavior-preserving migration — the API contract is untouched.

**Non-Goals:**
- Not rewriting route-level tenant guards (`enforceTenant`) — those stay; the repository adds defense-in-depth, it does not replace the auth layer.
- Not introducing a DI container or framework — plain module imports remain the wiring.
- Not converting services to classes.
- Not adding new transactions in this change beyond what's needed to validate the executor seam (#2 is unblocked here, not delivered here).
- Not delivering centralized access scoping (#5) — this change is its prerequisite.
- Not changing the Drizzle schema or running migrations.

## Decisions

### Decision 1: Plain object repositories, one module per table

Each repository is a plain exported object of async functions (matching the existing functional style), e.g. `apps/api/src/repositories/reservation.repository.ts` exporting `reservationRepository`. No classes, no base-class inheritance.

*Rationale:* Mirrors the existing service style (plain functions), keeps imports trivial, and an object of functions is trivially mockable in Vitest (`vi.fn()` per method, or a hand-rolled fake). A class hierarchy or generic `BaseRepository<T>` was considered and rejected: Drizzle's column types don't generalize cleanly across tables, and a generic base obscures the per-table tenant column. Per-table explicitness is the safer default for a multi-tenant system.

### Decision 2: Executor parameter, defaulting to `db`

Every method takes a trailing `executor: Executor = db` parameter, where `type Executor = DB | DbTransaction`. The transaction type is derived from Drizzle (`Parameters<Parameters<DB["transaction"]>[0]>[0]`), exported from `apps/api/src/db/index.ts` alongside `db`.

```ts
// apps/api/src/repositories/types.ts
export type Executor = DB | DbTransaction;
```

*Rationale:* This is the minimal seam that makes a method transaction-agnostic. Defaulting to `db` keeps non-transactional call sites unchanged (`reservationRepository.findById(id, restaurantId)`), while a service that opens a transaction passes `tx` explicitly. Considered an alternative of a request-scoped "unit of work" object; rejected as over-engineering for the current call patterns.

### Decision 3: `restaurantId` is a required, explicit parameter on tenant-scoped methods

Tenant-scoped read/update/delete methods take `restaurantId` as a required positional argument and apply `eq(table.restaurantId, restaurantId)` internally. Non-tenant tables (e.g. `adminUsers` keyed by email, slug-lookup on `restaurants`) are explicitly exempt and documented as such.

*Rationale:* Making `restaurantId` required and positional means a missing tenant filter becomes a compile error, not a silent leak — this is the core safety win. Deriving `restaurantId` implicitly from request context inside the repository was considered and rejected: repositories must stay free of Fastify/request coupling to remain unit-testable and reusable by workers/crons.

### Decision 4: Incremental per-service migration, leaf services first

Migrate one service per PR, starting with low-fan-in leaf services (`table.service.ts`, `guest.service.ts`) to validate the pattern, then higher-complexity ones (`reservation.service.ts`, `loyalty.service.ts`, `visit.service.ts`). Each PR: add/extend the repository for that table, switch the service to it, delete the now-dead inline filters, add a mocked-repository unit test, keep smoke green.

*Rationale:* A big-bang refactor of 24 files / 86 filters is high-risk and unreviewable. Incremental migration keeps each diff small, lets the smoke suite catch regressions early, and lets the pattern be corrected cheaply after the first one or two services. The first migrated service doubles as the reference implementation.

### Decision 5: Repository unit tests use a real schema, mocked-repo tests for services

Repositories themselves are thin enough that their primary test value is the tenant-filter guarantee; service tests inject fakes. Service unit tests stub the repository object. Repository methods, being the only DB-touching code, can be covered later by integration tests against a test database (out of scope here).

*Rationale:* Keeps the unit-test net fast and DB-free, which was the whole point. The mocked-repository service test required by the spec proves the seam delivers testability.

## Risks / Trade-offs

- **Behavior drift during migration** (a moved query subtly changes ordering/null handling) → Mitigation: migrate one service per PR; rely on the API smoke suite + per-service unit tests; diff queries 1:1 (move, don't rewrite).
- **Partial-state period**: some services use repositories, others still hit `db` directly → Mitigation: this is acceptable and expected; the two patterns coexist safely since repositories wrap the same `db`. Track remaining services in `tasks.md`.
- **Double tenant enforcement (route guard + repository filter) could mask a missing route guard** → Mitigation: keep both intentionally as defense-in-depth; the repository filter is the backstop, not a license to drop route guards. Document this in the repository convention note.
- **Executor type coupling to Drizzle internals** (`DbTransaction` derived from Drizzle generics may break on Drizzle upgrades) → Mitigation: isolate the type in one `repositories/types.ts`; a Drizzle major bump touches one file.
- **Over-abstraction risk** (repositories becoming a dumping ground for business logic) → Mitigation: convention — repositories contain only data access (queries + tenant filter); all business logic stays in services. Enforced in review.

## Migration Plan

1. Land the seam scaffolding: `repositories/types.ts` (`Executor`), export `DbTransaction` from `db/index.ts`, and a `CONVENTIONS`-style note documenting the repository rules. No behavior change.
2. Migrate the first leaf service (`table.service.ts`) end-to-end as the reference: repository + service switch + mocked-repo unit test. Review the pattern.
3. Migrate remaining services incrementally, one PR each, smoke green between each: `guest` → `reservation` → `waitlist` → loyalty/visit cluster → engagement/campaign/challenge cluster → analytics/summary/diagnostics → remainder.
4. After all tenant-scoped services are migrated, add a lint/CI guard (e.g. forbid `import { db }` inside `services/`) to prevent regression.
5. Rollback: each PR is independently revertible; reverting a single service PR restores its prior inline-filter implementation with no schema or contract impact.

## Open Questions

- Should non-tenant lookups (e.g. `restaurants` by slug, `adminUsers` by email) also live in repositories for consistency, or stay inline? Leaning yes for consistency, flagged per-table during migration.
- Do worker/cron entry points (engagement automation) call services or `db` directly today? If directly, they join the migration backlog — to confirm during the engagement-cluster PR.
- Timing of the CI guard (step 4): enable in "warn" mode mid-migration or only flip to "error" at the end to avoid blocking in-progress services.
