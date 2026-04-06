## Context

Sable is a restaurant reservation platform deployed on a VPS (204.168.227.45). Sprint 1-2 delivered working API, dashboard, booking widget, and guest profiles. The system is functional for BFF Ra'anana pilot but has critical gaps: no authentication, no hours editor, no reservation edit modal, no waitlist logic, no WhatsApp.

The codebase is a Turborepo monorepo: Fastify API + Drizzle ORM + PostgreSQL, React dashboard, Preact booking widget, shared `@openseat/domain` types. All deployed via systemd + nginx.

Two developers work in parallel:
- **Claude Code** (this session): API security, dashboard polish, infrastructure
- **Jake** (OpenClaw agent): Waitlist engine, WhatsApp skeleton, guest features

## Goals / Non-Goals

**Goals:**
- Make BFF Ra'anana pilot launch-ready (owner can manage everything from dashboard)
- Secure the API (JWT auth on all routes)
- Complete the core UX gaps (hours editor, reservation modal, guest editor)
- Implement waitlist auto-match (schema already exists)
- Apply widget branding from restaurant config
- Set up HTTPS
- Create WhatsApp session manager skeleton for Phase 1b

**Non-Goals:**
- Loyalty/gamification (Phase 2 — schema exists, no logic yet)
- Campaign manager (Phase 2)
- Multi-restaurant admin (Phase 3)
- Billing integration (Phase 3)
- Full AI agent loop (Phase 1b — just the skeleton now)
- Mobile app

## Decisions

### 1. JWT Authentication Strategy
**Decision:** Simple JWT with bcrypt password hashing. No OAuth, no social login.
**Why:** Single-tenant pilot needs minimal auth. JWT is stateless, works with Fastify, and the `JWT_SECRET` env var already exists.
**Alternatives considered:**
- Session-based auth (requires Redis session store — overkill for pilot)
- API keys (no user context, can't distinguish dashboard users)
**Implementation:**
- `POST /api/v1/auth/login` — accepts email+password, returns JWT
- Fastify `onRequest` hook validates JWT on all routes except `/health`, `/auth/login`, and widget endpoints (`/api/v1/reservations/availability`)
- Dashboard: login page, store JWT in localStorage, attach as `Authorization: Bearer` header
- Seed script creates initial admin user for BFF Ra'anana

### 2. Hours Editor — Inline Editing
**Decision:** Inline day-by-day time inputs on the Settings page, not a separate modal.
**Why:** Operating hours are a simple key-value map per day. A modal adds unnecessary navigation.
**Implementation:**
- 7-row grid (sun-sat), each with open/close time inputs + "closed" toggle
- Save button PATCHes restaurant `operatingHours` JSONB
- Uses existing `useUpdateRestaurant` mutation

### 3. Reservation Detail — Slide-over Panel
**Decision:** Right-side slide-over panel (not modal, not new page).
**Why:** Keeps context of the reservation list visible. RTL layout means slide from left.
**Implementation:**
- Click row → panel opens with full reservation details
- Editable fields: date, time, party size, notes, status
- Uses existing `useUpdateReservation` mutation
- Shows assigned table names, guest info with link to profile

### 4. Waitlist — Event-Driven on Cancellation
**Decision:** Check waitlist synchronously when a reservation is cancelled.
**Why:** BullMQ is available but adds complexity. For pilot scale (<50 reservations/day), synchronous check in the cancel handler is sufficient.
**Implementation:**
- On cancellation, query waitlist entries matching (restaurantId, date, partySize ≤ freed capacity)
- Set match status to 'offered', set 15-min expiry
- Return match info in cancel response (dashboard can show notification)
- Separate `POST /api/v1/waitlist/:id/accept` and auto-expire cron

### 5. Widget Branding — Fetch Config on Mount
**Decision:** Widget fetches `GET /api/v1/restaurants/:id` on mount, applies widgetConfig.
**Why:** Config is already in the restaurant record. No new endpoint needed.
**Implementation:**
- On mount, fetch restaurant config
- Apply `primaryColor` to buttons/accents via CSS variables
- Show `welcomeText` as header
- Show `logo` as header image if present

### 6. WhatsApp Skeleton — Baileys in Standalone Module
**Decision:** New `apps/api/src/whatsapp/` directory with session manager, not a separate app.
**Why:** Shares the same database and services. Separate process would need IPC.
**Implementation:**
- `session.ts` — Baileys connection, QR code generation, auth state persistence to file
- `handler.ts` — inbound message router (stub — logs messages for now)
- `sender.ts` — outbound message helper
- Not started with the gateway, loaded on-demand via admin endpoint

## Risks / Trade-offs

- **[JWT in localStorage]** → XSS could steal tokens. Mitigation: short expiry (24h), HttpOnly cookie as future improvement.
- **[Synchronous waitlist check]** → Blocks the cancel response for a few ms. Mitigation: acceptable at pilot scale. Move to BullMQ if latency matters.
- **[No email verification]** → Admin password is seeded, no reset flow. Mitigation: single-tenant pilot, owner has VPS access.
- **[Widget fetches restaurant config]** → Extra API call on mount. Mitigation: widget is only loaded once per page, config is small.

## Migration Plan

1. Add auth middleware (existing routes remain unchanged, just protected)
2. Seed admin user in seed.ts
3. Dashboard login page + auth header injection
4. Deploy, verify all endpoints require auth
5. Certbot for HTTPS, update nginx
6. Remaining features (hours editor, modal, waitlist, widget branding) deployed incrementally
