# Progress Log

## 2026-04-07 (Super-admin dashboard + tenant enforcement)

### Added
- OpenSpec change `openspec/changes/super-admin-dashboard/` with proposal, design, tasks, and capability updates for role-aware auth + multi-restaurant dashboard switching.
- Backend support for `super_admin` users:
  - `admin_users.role` enum (`admin` / `super_admin`)
  - nullable `restaurant_id` for platform-wide users
  - `GET /api/v1/admin/restaurants`
  - role-aware JWT/login response
- Dashboard support for platform admins:
  - role-aware auth state in `useAuth`
  - `/restaurants` picker page
  - sidebar link for switching active restaurant context
  - `X-Restaurant-Id` header for super-admin API requests

### Security / Enforcement
- Tightened auth middleware so only `GET /api/v1/restaurants` and `GET /api/v1/restaurants/:id` stay public; restaurant subroutes like `/dashboard` and `/table-status` are no longer accidentally public.
- Added tenant checks across core dashboard routes (`restaurants`, `reservations`, `guests`, `tables`, `waitlist`) so normal admins cannot cross restaurant boundaries by passing arbitrary IDs.

### Verified
- `pnpm --filter @openseat/api type-check`
- `pnpm --filter @openseat/dashboard type-check`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- Applied DB migration `0004_admin_roles.sql` locally.
- Smoke-tested a temp API instance on port 3101:
  - super-admin login returns `role=super_admin` and `restaurant=null`
  - `GET /api/v1/admin/restaurants` returns tenant list for super-admin
  - regular restaurant admin gets `403` on that endpoint
- Fixed E2E auth/env drift after the rebase:
  - `apps/e2e` now auto-loads repo `.env` for direct local runs
  - table-status E2E now uses auth (route is intentionally protected)
  - public waitlist create/accept flows no longer crash when `request.user` is absent
  - full `pnpm --filter @openseat/e2e test` passes against a fresh temp API on port 3101 (15/15)
- Fixed the failing Vercel preview build on PR #5:
  - `apps/api/src/routes/agent.ts` now passes a concrete `AgentRequest` type into the legacy agent handler
  - verified locally with `pnpm --filter @openseat/api build`, `pnpm --filter @openseat/api type-check`, and `pnpm --filter @openseat/dashboard build`

### Notes
- Updated `milhemsione@gmail.com` in the local DB to `super_admin` for validation.
- Current picker shows one tenant (BFF Ra'anana) today, but the flow is now ready for multi-restaurant onboarding.

## 2026-04-07 (Guides + Sprint 3b completion)

### Verified
- All Sprint 3b features confirmed implemented and functional:
  - Waitlist service + auto-match on cancellation
  - Guest preference editor in dashboard
  - Guest auto-tagging by visit count (חדש/חוזר/קבוע/VIP)
  - Dashboard login page + auth wrapper
- All 5 apps build cleanly (full turbo cache)

### Created
- `docs/OWNER-GUIDE.md` — comprehensive guide for restaurant owner (dashboard, reservations, guests, loyalty, engagement, daily workflow)
- `docs/CUSTOMER-GUIDE.md` — customer-facing guide (widget booking, chat booking, loyalty program, waitlist)
- `docs/CUSTOMER-GUIDE-HE.md` — Hebrew version of customer guide

### Infrastructure
- Telegram group configured: OpenSeat (-1003691973621) with topics (General=1, Owner=17, Reports=20)
- Hermes bot already connected to group via openclaw config

### Still Needed
- Telegram bot bridge for customer-facing agent testing (separate from Hermes, needs @BotFather token)
- WhatsApp Baileys integration (parked for now)
- SSL/HTTPS (needs domain)
- Real BFF Ra'anana data (actual hours, table layout)

## 2026-04-06 (Sprint 3b completion + E2E test runner)

### Sprint 3b — Completed
- [x] Waitlist service + routes + auto-match on cancellation (was already built)
- [x] Guest preference editor in dashboard (GuestDetailPage with tags, notes, insights)
- [x] Guest auto-tagging by visit count (fires automatically on visit creation)
- [x] Dashboard login page + auth wrapper (ProtectedRoute, localStorage JWT)
- [x] Waitlist public routes (POST /waitlist and POST /waitlist/:id/accept)
- [ ] WhatsApp session manager — on hold, using Hermes+Telegram for testing

### CI/CD Fixes
- Fixed PR #1 and PR #2 — merged into single PR, resolved conflicts
- CI: build @openseat/domain before API type-check
- Smoke test: skip gracefully when GitHub secrets not configured
- Vercel deploy: fixed Drizzle ORM type mismatch (challenges innerJoin)

### E2E Test Runner (PR #3)
- Added `@openseat/e2e` package — 15 tests covering full API flow
- Tests: health, restaurants, availability, reservation CRUD, status transitions, loyalty, visits, guest profiles, tables, dashboard, waitlist
- All 15 passing in ~230ms against live API
- API client with auto token refresh on 401
- Set ADMIN_SEED_PASSWORD in .env for authenticated test flows
- Hermes can trigger via `pnpm --filter @openseat/e2e test`

## 2026-04-06 (Reliability audit + deployment hardening)

### Verified
- Confirmed Vercel CLI deployment inspection is currently blocked on this VPS without Vercel auth (`npx vercel inspect ...` returns `No existing credentials found`), so deployment-log diagnosis must use a logged-in Vercel session or token.
- Ran local + external API smoke coverage:
  - `scripts/e2e-test.sh` now passes end-to-end against the live local API service.
  - Added `scripts/api-reliability-smoke.mjs` to exercise login, availability, reservation creation/listing, status transitions, loyalty balance, table status, guest full profile, visit logging, and visit insights.
  - Verified the same smoke flow works against both `http://localhost:3001` and `http://204.168.227.45`.
- Rebuilt frontend apps successfully after fixes:
  - `@openseat/dashboard`
  - `@openseat/booking-widget`
  - `@openseat/marketing`

### Fixed
- Dashboard deployment path bug:
  - `apps/dashboard/vite.config.ts` no longer hardcodes `base: "/dashboard/"`; asset URLs now build for the actual deploy root by default.
  - `apps/dashboard/src/main.tsx` no longer hardcodes `basename="/dashboard"`.
  - Router basename now follows Vite `BASE_URL`, preventing blank-page behavior when the dashboard is deployed at the site root.
- Booking widget Vercel root 404:
  - Added `apps/booking-widget/scripts/postbuild-demo.mjs`.
  - Booking widget build now emits `dist/index.html` alongside `openseat-booking.iife.js`, so the deployed root URL serves a working demo page instead of Vercel `404: NOT_FOUND`.
- Booking widget API routing on Vercel:
  - Added `/api/:path*` rewrite to `apps/booking-widget/vercel.json` so the demo page can talk to the live API over the same origin.
- Admin login reproducibility:
  - Added optional `ADMIN_SEED_PASSWORD` env handling in `apps/api/src/env.ts` and `apps/api/src/db/seed.ts`.
  - Seed now syncs the existing admin password when `ADMIN_SEED_PASSWORD` is provided, instead of relying on a one-time random password.
  - Updated `.env.example` and `scripts/e2e-test.sh` to use environment-driven admin credentials instead of a stale hardcoded password.

### Remaining Follow-up
- `pnpm lint` is still not a trustworthy gate: frontend lint scripts call ESLint, but the workspace is not fully wired for a clean lint pass yet.
- To inspect failed Vercel deployments directly from this VPS, add Vercel auth (`vercel login` or token) for the deployment owner.

## 2026-04-04 (VPS Bootstrap + Sprint 1 Completion)

### Infrastructure
- Fresh VPS bootstrapped: Node v22.22.2, pnpm 10.30.3, PostgreSQL 16, Redis 7, Nginx
- Drizzle migrations generated and applied to production DB
- Seed data loaded: BFF Ra'anana restaurant, 10 tables, 3 test guests, 8 reservations (today + tomorrow)
- OpenSeat API running as systemd service on port 3001
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
- Fixed initial TypeScript issues in the monorepo (`@openseat/booking-widget` env handling, `@openseat/domain` TS project references).
- Implemented API service layer in `apps/api/src/services/`:
  - `guest.service.ts` — find-or-create by phone, list/get helpers, and preference/tags/notes updater, with mapping to shared domain `Guest` type.
  - `table.service.ts` — list helpers (with `includeInactive`), CRUD helpers for tables, and a smallest-fit table assignment helper.
  - `reservation.service.ts` — availability calculation based on restaurant operating hours + existing reservations, smallest-fit table assignment, create/list/update/cancel reservation flows, and mapping to shared domain `Reservation` type.
- Wired Fastify routes to use the new services and shared domain schemas:
  - `routes/reservations.ts` now uses `@openseat/domain` Zod schemas + reservation service for availability, create, list, update, and cancel.
  - `routes/guests.ts` now uses `@openseat/domain` Zod schema + guest service for list/get/create/update.
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
