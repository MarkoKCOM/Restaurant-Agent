# Progress Log

## 2026-04-03 (Evening)

### Done
- Full monorepo scaffold with Turborepo + pnpm workspaces
- `apps/api` — Fastify server with Drizzle schema (all core + growth tables), route stubs for reservations/guests/tables/restaurants, zod env validation
- `apps/dashboard` — React + Vite + Tailwind, RTL layout with sidebar, 4 pages (Today, Reservations, Guests, Settings) with UI shells
- `apps/booking-widget` — Preact embeddable widget with multi-step booking flow (date → time → details → confirm), IIFE build config
- `apps/marketing-site` — React landing page with hero, features, pricing tables (Starter + Growth tiers), CTA
- `packages/domain` — Shared types (Restaurant, Table, Guest, Reservation, etc.) + Zod validation schemas
- Agent workspace files pushed to repo (SOUL.md, IDENTITY.md, USER.md, AGENTS.md, etc.)
- 15 skills linked to Jake (6 core + 5 autonomy + 4 React/design)
- MVP-PHASE-1.md locked, ROADMAP.md created, ARCHITECTURE.md updated

### What's Scaffolded (Structure Ready, TODO Logic)
- API route handlers — stubs with zod validation, need actual DB queries + domain logic
- Dashboard pages — UI shells with Hebrew labels, need API integration + data rendering
- Widget — multi-step flow, needs real availability fetch + reservation submit
- Marketing site — complete static landing page

### Next (Sprint 1 Remaining)
- [x] `pnpm install` + verify builds
- [ ] Drizzle migrations (generate + run against local PostgreSQL)
- [x] Seed script with BFF Raanana test data
- [x] Implement reservation service — availability check, auto table assignment, create/modify/cancel
- [x] Implement guest service — find-or-create, visit history
- [ ] Wire dashboard to API with React Query
- [ ] Wire widget availability fetch to real API

## 2026-04-03 (Afternoon — Sprint 1 API work)

### Done
- Ran `pnpm install` at repo root; workspace dependencies install cleanly.
- Fixed initial TypeScript issues in the monorepo (`@sable/booking-widget` env handling, `@sable/domain` TS project references).
- Implemented API service layer in `apps/api/src/services/`:
  - `guest.service.ts` — find-or-create by phone, list/get helpers, and preference/tags/notes updater, with mapping to shared domain `Guest` type.
  - `table.service.ts` — list helpers (with `includeInactive`), CRUD helpers for tables, and a smallest-fit table assignment helper.
  - `reservation.service.ts` — availability calculation based on restaurant operating hours + existing reservations, smallest-fit table assignment, create/list/update/cancel reservation flows, and mapping to shared domain `Reservation` type.
- Wired Fastify routes to use the new services and shared domain schemas:
  - `routes/reservations.ts` now uses `@sable/domain` Zod schemas + reservation service for availability, create, list, update, and cancel.
  - `routes/guests.ts` now uses `@sable/domain` Zod schema + guest service for list/get/create/update.
  - `routes/tables.ts` now uses table service for list/create/update/deactivate.
- Normalized Drizzle schema types for reservations/waitlist time & date columns to use string types in TypeScript, matching the shared domain model.
- Confirmed `pnpm type-check` passes across all workspaces (api, dashboard, booking-widget, marketing-site, domain).
- Added `apps/api/src/db/seed.ts` with BFF Ra'anana test data:
  - Upserts a `restaurants` record for BFF Ra'anana (slug `bff-raanana`) with address, contact info, operating hours, and basic widget config.
  - Seeds 10 tables with varying capacities for that restaurant.
  - Seeds a few test guests for that restaurant (idempotent by phone number).

### Next
- Wire dashboard pages to the new API services via React Query (today snapshot, reservations list, guests).
- Wire booking widget date step to `/api/v1/reservations/availability` and submit step to real reservation creation.
- Add a couple of seed reservations for BFF Ra'anana to make the dashboard and availability views feel real.
- Run Drizzle migrations against a local PostgreSQL instance and verify seed works end-to-end.

## 2026-04-03 (Initial)

- Reviewed existing specs in `openspec/changes/restaurant-agent-product-plan`
- Confirmed Phase 1: web-first (API + dashboard + widget + marketing), WhatsApp is Phase 1b
- Created initial directory structure
