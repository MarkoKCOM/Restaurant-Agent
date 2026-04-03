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
- [ ] `pnpm install` + verify builds
- [ ] Drizzle migrations (generate + run against local PostgreSQL)
- [ ] Seed script with BFF Raanana test data
- [ ] Implement reservation service — availability check, auto table assignment, create/modify/cancel
- [ ] Implement guest service — find-or-create, visit history
- [ ] Wire dashboard to API with React Query
- [ ] Wire widget availability fetch to real API

## 2026-04-03 (Initial)

- Reviewed existing specs in `openspec/changes/restaurant-agent-product-plan`
- Confirmed Phase 1: web-first (API + dashboard + widget + marketing), WhatsApp is Phase 1b
- Created initial directory structure
