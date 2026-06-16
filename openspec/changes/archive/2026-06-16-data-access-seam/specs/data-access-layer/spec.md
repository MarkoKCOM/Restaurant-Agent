## ADDED Requirements

### Requirement: Repository layer mediates all service database access

Each domain table SHALL have a repository module under `apps/api/src/repositories/`. Services SHALL access persistent data only through repository methods, not by importing the Drizzle `db` singleton directly. Repository methods SHALL expose intent-named operations (e.g. `findById`, `findByRestaurant`, `insert`, `update`, `delete`) rather than exposing raw query builders to callers.

#### Scenario: Service reads through a repository

- **WHEN** a service needs guests for a restaurant
- **THEN** it calls `guestRepository.findByRestaurant(restaurantId, executor)` instead of writing `db.select().from(guests).where(eq(guests.restaurantId, ...))`

#### Scenario: A migrated service no longer imports the db singleton

- **WHEN** a service has been migrated to the repository layer
- **THEN** that service file contains no direct `import { db } from "../db"` and no inline `eq(table.restaurantId, ...)` filter

### Requirement: Repositories enforce tenant scoping centrally

A repository method that operates on tenant-scoped data SHALL require a `restaurantId` argument and SHALL apply the `restaurantId` filter internally on every read, update, and delete. Callers SHALL NOT be able to obtain rows for an arbitrary restaurant without supplying the `restaurantId`. The inline `eq(table.restaurantId, ...)` filters currently written in services SHALL be moved into the repositories.

#### Scenario: Tenant filter applied automatically

- **WHEN** `reservationRepository.findById(id, restaurantId, executor)` is called
- **THEN** the underlying query filters by both `id` and `restaurantId`, so a reservation belonging to another restaurant returns null

#### Scenario: Tenant-scoped method requires restaurantId

- **WHEN** a repository method reads, updates, or deletes tenant-scoped rows
- **THEN** its signature requires a non-optional `restaurantId` parameter

### Requirement: Repositories are transaction-aware via an executor

Every repository method SHALL accept a database executor (the `db` instance or a Drizzle transaction `tx`) so the same method works inside or outside a transaction. When no executor is supplied, the method SHALL default to the shared `db` instance. Services SHALL be able to compose multiple repository calls inside a single `db.transaction` by passing the transaction `tx` to each call.

#### Scenario: Repository call outside a transaction

- **WHEN** a service calls `tableRepository.findByRestaurant(restaurantId)` without an executor
- **THEN** the method runs against the default `db` instance

#### Scenario: Repository calls composed in one transaction

- **WHEN** a service runs `db.transaction(async (tx) => { await guestRepository.insert(data, tx); await visitRepository.insert(visit, tx); })`
- **THEN** both writes use the same transaction `tx` and commit or roll back atomically

### Requirement: Services are unit-testable without a database

Because services depend on repositories rather than the `db` singleton, a service SHALL be unit-testable by substituting a fake or mocked repository. At least one migrated service SHALL have a unit test that exercises its logic with a mocked repository and no live database connection.

#### Scenario: Service tested with a mocked repository

- **WHEN** a unit test runs a migrated service with a stubbed repository returning fixture rows
- **THEN** the test asserts the service's behavior and output without connecting to PostgreSQL

### Requirement: Migration preserves existing behavior

The migration to repositories SHALL be behavior-preserving. No route contract, request schema, response shape, or HTTP status code SHALL change as a result of this change. The existing API smoke suite and unit tests SHALL continue to pass after each service is migrated.

#### Scenario: API contract unchanged after migration

- **WHEN** a service has been migrated to repositories
- **THEN** the API smoke suite and unit test suite pass with no change to any route's response shape or status code
