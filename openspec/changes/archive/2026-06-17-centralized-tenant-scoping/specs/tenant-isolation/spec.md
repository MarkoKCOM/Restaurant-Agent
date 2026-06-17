## ADDED Requirements

### Requirement: A request or job carries an active tenant context

The system SHALL maintain a request/job-scoped tenant context holding the active `restaurantId` and role, established at the entry points: the HTTP auth hook (from `request.user`) and every BullMQ worker/cron processor and the seed (from job data). Repository tenant scoping SHALL derive the active `restaurantId` from this context rather than from an argument threaded through every call.

#### Scenario: HTTP request establishes tenant context

- **WHEN** an authenticated `admin` or `employee` request is handled
- **THEN** the tenant context is set to that user's `restaurantId` for the duration of the request

#### Scenario: Worker job establishes tenant context

- **WHEN** a BullMQ worker or cron processor runs a job carrying `restaurantId` in its data
- **THEN** the tenant context is set to that `restaurantId` for the duration of the job

### Requirement: By-PK repository reads and writes are tenant-scoped by default

The by-primary-key repository methods on the 14 tenant-scoped tables SHALL filter by the active tenant's `restaurantId`. Crossing tenants SHALL only be possible through explicitly named unscoped methods (e.g. `*Unscoped`), which are the sole sanctioned cross-tenant path and are auditable by name.

#### Scenario: By-id read cannot return another tenant's row

- **WHEN** a request scoped to restaurant A calls a by-id repository read with an id that belongs to restaurant B
- **THEN** the method returns null (no row), as if it did not exist

#### Scenario: By-id write cannot modify another tenant's row

- **WHEN** a request scoped to restaurant A calls a by-id repository update with an id that belongs to restaurant B
- **THEN** no row is updated and the method reports no match

#### Scenario: Explicit unscoped method is required to cross tenants

- **WHEN** code needs to operate across tenants (super_admin or a system bootstrap)
- **THEN** it must call an explicitly named `*Unscoped` repository method; the default by-id methods cannot cross tenants

### Requirement: The database provisions tenant-isolation Row-Level Security

PostgreSQL Row-Level Security SHALL be enabled on the 14 tenant-scoped tables (plus `challengeProgress` via a `challenges` subquery), with policies keyed off a per-transaction setting (`app.current_restaurant_id`) applied via `SET LOCAL` and a nil-UUID bypass sentinel for `super_admin`/system. The policies are validated to isolate by `pnpm db:rls-proof` (which transactionally `FORCE`s RLS and asserts the scenarios below).

These policies ship in **verify mode**: RLS is enabled but not `FORCE`d, so the application — which connects as the table owner — bypasses RLS, and the **application layer (tenant-scoped repositories) is the active enforcement**. The scenarios below describe the guarantee once RLS is `FORCE`d (the fail-closed flip + transaction-per-request wiring), which is intentionally deferred (see the change's deferred Phase 2b); the proof script demonstrates they already hold under `FORCE`.

#### Scenario: Hand-written query cannot bypass isolation

- **WHEN** any query (even one bypassing the repositories) runs with `app.current_restaurant_id` = restaurant A
- **THEN** it can only read or write rows where `restaurantId` = A (for `challengeProgress`, the restaurant derived via its `challenge`)

#### Scenario: Session setting does not leak across pooled connections

- **WHEN** two requests for different restaurants are served on the same pooled connection in sequence
- **THEN** neither sees the other's rows, because the tenant setting is transaction-scoped (`SET LOCAL`) and does not persist on the connection

### Requirement: super_admin retains explicit cross-tenant access

`super_admin` SHALL retain the ability to act across restaurants through a single, explicit, auditable bypass (the `x-restaurant-id` selection plus an RLS bypass path). No `admin` or `employee` SHALL be able to obtain cross-tenant access by any route.

#### Scenario: super_admin acts on a selected restaurant

- **WHEN** a `super_admin` selects restaurant B (via `x-restaurant-id`) and reads its data
- **THEN** the request succeeds and returns restaurant B's data

#### Scenario: non-super-admin cannot escalate

- **WHEN** an `admin` of restaurant A sends a request targeting restaurant B (by id, query param, or header)
- **THEN** the request is denied or returns no cross-tenant data

### Requirement: Isolation is proven by automated tests

The test suite SHALL include deliberate cross-tenant access attempts that must fail. Two layers cover this: repository unit tests assert a by-id read/write for a foreign-tenant id returns null/no-match under a mocked context, and `pnpm db:rls-proof` transactionally `FORCE`s RLS against the real DB and asserts the database denies cross-tenant access. A full end-to-end cross-tenant API test is deferred together with the fail-closed flip (Phase 2b).

#### Scenario: Cross-tenant read/write is denied at the repository

- **WHEN** a repository by-id read or update is issued under a tenant context for restaurant A against an id owned by restaurant B
- **THEN** it returns null / matches no row (covered by `repositories/tenant-scope.test.ts`)

#### Scenario: The database denies cross-tenant access under FORCEd RLS

- **WHEN** `pnpm db:rls-proof` sets `app.current_restaurant_id` to restaurant A and queries a FORCEd tenant table
- **THEN** only A's rows are visible (0 leak), the bypass sentinel sees all, a non-matching/unset setting denies everything, and a WITH CHECK violation blocks rewriting `restaurant_id` to escape

### Requirement: No behavior change for legitimate same-tenant traffic

Correct same-tenant requests SHALL return the same responses (status codes and shapes) as before this change. The 22 migrated services, the transaction behavior, and the existing CI gates (build/lint, repo-sql-smoke, e2e) SHALL remain green.

#### Scenario: Same-tenant request is unaffected

- **WHEN** an `admin` of restaurant A performs any in-tenant operation that worked before
- **THEN** it returns the same status code and response shape as before
