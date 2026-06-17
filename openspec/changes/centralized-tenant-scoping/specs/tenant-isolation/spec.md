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

### Requirement: The database enforces tenant isolation via Row-Level Security

PostgreSQL Row-Level Security SHALL be enabled on the 14 tenant-scoped tables, with policies keyed off a per-transaction setting (`app.current_restaurant_id`) applied via `SET LOCAL`. A query that runs without the setting, or with another tenant's value, SHALL NOT return or modify rows of a different restaurant — independent of any application-layer check.

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

### Requirement: Isolation is proven by an automated cross-tenant test

The test suite SHALL include a deliberate cross-tenant access attempt that must fail, exercised end-to-end through the API, and run as part of CI.

#### Scenario: Cross-tenant attempt fails in CI

- **WHEN** the e2e/integration gate runs a scenario where restaurant A's admin attempts to read and to modify a resource owned by restaurant B
- **THEN** both attempts fail (404/403 / no rows affected), and the test passes only because the access was denied

### Requirement: No behavior change for legitimate same-tenant traffic

Correct same-tenant requests SHALL return the same responses (status codes and shapes) as before this change. The 22 migrated services, the transaction behavior, and the existing CI gates (build/lint, repo-sql-smoke, e2e) SHALL remain green.

#### Scenario: Same-tenant request is unaffected

- **WHEN** an `admin` of restaurant A performs any in-tenant operation that worked before
- **THEN** it returns the same status code and response shape as before
