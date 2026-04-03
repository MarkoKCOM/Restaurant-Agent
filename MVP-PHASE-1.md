# MVP Phase 1 — Starter Package (Web-First)

**Goal:** Core reservation product as web app + API. WhatsApp integration is Phase 1b (after web flow is solid).
**Pilot:** BFF Raanana (free).
**Stack:** Fastify + Drizzle + PostgreSQL + Redis | React + Vite + Tailwind + shadcn/ui | Preact widget

---

## In Scope

### 1. Backend API (`packages/api`)

- Fastify + TypeScript server
- Drizzle ORM — core tables: restaurants, tables, guests, reservations, waitlist, conversations
- Growth tables defined in schema (not implemented): loyalty_transactions, rewards, campaigns, challenges, etc.
- Core reservation logic:
  - `POST /reservations` — create with auto table assignment (smallest fit, combinable)
  - `PATCH /reservations/:id` — modify (revalidate availability)
  - `DELETE /reservations/:id` — cancel, free table, notify waitlist
  - `GET /availability` — open slots for date/time/party_size
  - Waitlist: add, auto-match on cancellation, 15-min hold expiry
  - No-show flagging + repeat offender tracking (3+)
  - Operating hours + special dates enforcement
- Guest CRM basics:
  - Auto-create profile on first booking
  - Visit history on reservation completion
  - Preferences, notes, tags
- Auth: per-restaurant login (simple JWT, stubbed for pilot)
- Environment validation with zod
- Health check, error handling, request logging

### 2. Owner Dashboard (`packages/dashboard`)

- React + Vite + Tailwind + shadcn/ui
- Pages:
  - **Today** — today's reservations, occupancy by time slot, waitlist
  - **Reservations** — list + detail, update status (confirm/seat/complete/no-show)
  - **Guests** — list + profile (history, preferences, tags, notes)
  - **Settings** — restaurant details, hours, table map editor, widget branding
- Basic analytics on dashboard home:
  - Bookings & covers (today / this week)
  - Cancellation + no-show rates

### 3. Web Booking Widget (`packages/widget`)

- Preact embeddable bundle (tiny, <30KB gzipped)
- Date picker → time slot selector (real-time availability) → party size → name + phone → confirmation
- Single `<script>` embed tag
- Branding config: logo, primary color, welcome text
- Mobile-first responsive

### 4. Marketing Site (`packages/marketing`)

- React + Vite + Tailwind
- Hero, value prop, Starter vs Growth comparison, pricing table, CTA (demo / pilot signup)
- SEO-ready, fast

---

## Out of Scope (Phase 1)

- WhatsApp gateway (Baileys) — Phase 1b, after web flow works
- Agent AI loop (intent classification, Claude conversation) — Phase 1b
- Engagement automation, campaign manager — Phase 2
- Loyalty engine, gamification — Phase 2
- Deep analytics dashboard — Phase 2
- Billing, multi-restaurant admin — Phase 3
- Voice/phone, POS integration — Future

---

## Sprint Plan

### Sprint 1 (Foundation)
- [x] Monorepo scaffold (Turborepo)
- [ ] Drizzle schema + migrations + seed (BFF Raanana test data)
- [ ] Fastify server skeleton (health, auth middleware, error handler)
- [ ] Redis + BullMQ setup
- [ ] API routes: availability, reservations CRUD, guests CRUD, tables CRUD
- [ ] Dashboard shell: routing, layout, auth stub
- [ ] Widget shell: embed script, availability fetch

### Sprint 2 (Core Flow)
- [ ] Reservation engine: auto table assignment, waitlist, no-show tracking
- [ ] Dashboard: Today view, Reservations list + detail, Guest profiles
- [ ] Widget: full booking flow with real-time availability
- [ ] Settings page: hours editor, table map, branding
- [ ] Basic analytics snapshot on dashboard home

### Sprint 3 (Polish + Pilot)
- [ ] End-to-end test: widget booking → API → dashboard view
- [ ] Mobile-responsive polish on dashboard + widget
- [ ] Marketing site build
- [ ] BFF Raanana: load real data, test with owner
- [ ] Bug fixes, edge cases, UX polish

---

## Success Criteria

1. Guest books via web widget → reservation created → shows in dashboard
2. Owner can view/manage today's reservations, update status
3. Table assignment is automatic and correct
4. Waitlist works when full — auto-notify on cancellation
5. No-shows tracked, repeat offenders flagged
6. Widget is embeddable with a single script tag
7. Dashboard is clean, fast, mobile-friendly
8. BFF Raanana owner says "this works"

---

## Blockers

- [ ] Need from BFF owner: exact table layout, full menu, cancellation policy
