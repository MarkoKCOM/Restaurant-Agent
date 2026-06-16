## Why

The OpenSeat API has **86 hand-written `eq(table.restaurantId, ...)` tenant-scoping filters** spread across 24 service files, every one of which must be remembered by hand. A single forgotten filter is a cross-restaurant data leak. Because services import the Drizzle `db` singleton directly, they cannot be unit-tested without a live PostgreSQL instance, and the whole API has only **one** `db.transaction` (in the signup flow). A data-access seam (a thin repository layer between services and Drizzle) is the prerequisite identified by the 2026-06-15 architecture review: it centralizes tenant scoping in one place, makes services unit-testable by mocking repositories, and unblocks both real transactions and centralized access scoping.

## What Changes

- Introduce a **repository layer** at `apps/api/src/repositories/` — one module per domain table (reservations, guests, tables, etc.) exposing intent-named methods (`findByRestaurant`, `findById`, `insert`, `update`) instead of raw Drizzle calls.
- Repositories accept an **executor** (`db` or a transaction `tx`) so the same code path works inside and outside a transaction — this is what unblocks transactions (#2).
- Tenant scoping (`eq(table.restaurantId, ...)`) is **applied inside the repository**, derived from a required `restaurantId` argument, so services no longer hand-write the filter. This is the seam that unblocks centralized scoping (#5).
- Migrate services to repositories **incrementally, one service at a time**, leaving behavior identical. No route contract changes.
- Services become **unit-testable**: tests inject a fake/mocked repository instead of needing a database.
- Establish the repository pattern and conventions so future tables follow it by default.

This change is **non-breaking** — it is an internal refactor. No public API, route, or response shape changes.

## Capabilities

### New Capabilities
- `data-access-layer`: A repository seam between API services and Drizzle that centralizes tenant scoping, supports transaction-aware execution, and makes services unit-testable.

### Modified Capabilities
<!-- None — no existing openspec/specs/ capabilities, and no external behavior changes. -->

## Impact

- **New code**: `apps/api/src/repositories/` (one module per table + a shared executor/base type), plus repository unit tests under the Vitest foundation merged in #27.
- **Modified code**: the 24 service files in `apps/api/src/services/` migrate from direct `db` calls to repository calls, incrementally. The 86 inline `eq(restaurantId)` filters move into repositories.
- **Unblocks**: transactions (#2) via the executor parameter; centralized access scoping (#5) via single-point tenant enforcement; deeper service-level unit tests.
- **Dependencies**: no new runtime dependencies; uses existing Drizzle + Vitest.
- **Risk**: behavior-preserving refactor across many files; mitigated by incremental per-service migration and the existing API smoke + unit test net.
