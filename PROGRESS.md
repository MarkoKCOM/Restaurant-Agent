# Progress Log

## 2026-04-04 (VPS Bootstrap + Sprint 1 Completion)

### Infrastructure
- Fresh VPS bootstrapped: Node v22.22.2, pnpm 10.30.3, PostgreSQL 16, Redis 7, Nginx
- Drizzle migrations generated and applied to production DB
- Seed data loaded: BFF Ra'anana restaurant, 10 tables, 3 test guests, 8 reservations (today + tomorrow)
- Sable API running as systemd service on port 3001
- Nginx reverse proxy: `/api/*` → API, `/` → dashboard static files
- GitHub SSH (MarkoKCOM) + CLI (marciano147) verified

### Sprint 1 — Completed
- [x] Drizzle migrations (generate + run against PostgreSQL)
- [x] Seed script with BFF Raanana test data + reservations
- [x] Restaurant routes implemented (list, get, update, dashboard snapshot, tables)
- [x] Dashboard wired to API via React Query hooks:
  - Today page: live stats (reservations, covers, cancellations, no-shows) + reservation list
  - Reservations page: date/status filtering, status change actions (seat, complete, cancel)
  - Guests page: list with search, shows tier and tags
  - Settings page: editable restaurant details, operating hours display, table grid
- [x] Booking widget wired to real API:
  - Fetches available time slots from `/api/v1/reservations/availability`
  - Submits real reservations via POST
  - Error handling, loading states, back navigation
- [x] Added `/api/v1/health` route alias

### Sprint 2 — Completed
- [x] No-show tracking — `POST /reservations/:id/no-show`, increments guest noShowCount
- [x] Visit tracking — auto-increments visitCount + lastVisitDate on reservation completion
- [x] Operating hours enforcement — createReservation validates against restaurant hours
- [x] Dashboard occupancy heatmap — 30-min slot heatmap with amber color gradient
- [x] Guest profiles — detail page with visit history (last 20 reservations), clickable rows
- [x] No-show button on reservation actions (confirmed/seated)

### Sprint 3a — Completed (Claude Code)
- [x] JWT authentication on all API routes (fastify-plugin, global hook)
- [x] Login endpoint POST /api/v1/auth/login + admin user seeded
- [x] Settings hours editor — editable per-day time inputs with save
- [x] Settings table editor — add/edit/delete tables inline
- [x] Reservation detail panel — slide-over with full edit form
- [x] Widget branding — fetches widgetConfig, applies primaryColor/logo/welcomeText
- [x] Widget phone validation — Israeli format (0xx / +972)
- [x] Past-date rejection on createReservation (Asia/Jerusalem)
- [x] Marketing site rebuilt — bilingual HE/EN, launch offer, updated pricing
- [x] PACKAGES.md — full pricing/features/add-ons reference
- [x] ROADMAP.md updated to reflect actual state
- [x] OpenSpec sprint-3-pilot-ready change with 6 specs

### Sprint 3b — In Progress (Jake / OpenClaw)
- [ ] Waitlist service + routes + auto-match on cancellation
- [ ] Guest preference editor in dashboard
- [ ] Guest auto-tagging by visit count
- [ ] WhatsApp session manager skeleton (Baileys)
- [ ] WhatsApp handler stub + sender + admin routes
- [ ] End-to-end test flow

### Still Needed for Pilot Launch
- [ ] Dashboard login page + auth wrapper (redirect to /login if no JWT)
- [ ] SSL/HTTPS (needs domain pointed to VPS)
- [ ] Real BFF Ra'anana data (actual hours, table layout, menu)
- [ ] 1-week soft launch test with owner

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
