# Architecture Overview

## Monorepo Layout

Turborepo + pnpm workspaces. Each app is independently buildable and deployable.

```text
sable/
├── package.json              # Root — Turborepo scripts
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json        # Shared TS config
├── .env.example
│
├── apps/
│   ├── api/                  # Backend — Fastify + Drizzle + BullMQ
│   │   ├── src/
│   │   │   ├── index.ts      # Server entry
│   │   │   ├── env.ts        # Zod-validated env config
│   │   │   ├── db/
│   │   │   │   ├── schema.ts # Full Drizzle schema (core + growth tables)
│   │   │   │   └── index.ts  # DB connection
│   │   │   ├── routes/
│   │   │   │   ├── reservations.ts
│   │   │   │   ├── guests.ts
│   │   │   │   ├── tables.ts
│   │   │   │   └── restaurants.ts
│   │   │   └── services/     # Domain logic (TODO)
│   │   └── drizzle.config.ts
│   │
│   ├── dashboard/            # Owner dashboard — React + Vite + Tailwind + shadcn/ui
│   │   └── src/
│   │       ├── App.tsx       # Router: Today, Reservations, Guests, Settings
│   │       ├── components/
│   │       │   └── Layout.tsx  # RTL sidebar + main content
│   │       └── pages/
│   │           ├── TodayPage.tsx
│   │           ├── ReservationsPage.tsx
│   │           ├── GuestsPage.tsx
│   │           └── SettingsPage.tsx
│   │
│   ├── booking-widget/       # Embeddable widget — Preact (IIFE bundle)
│   │   └── src/
│   │       ├── main.tsx      # Auto-mount + SableBooking.mount()
│   │       └── BookingWidget.tsx
│   │
│   └── marketing-site/       # Landing page — React + Vite + Tailwind
│       └── src/
│           └── LandingPage.tsx
│
├── packages/
│   └── domain/               # Shared types, Zod schemas, API helpers
│       └── src/
│           ├── types.ts      # Restaurant, Table, Guest, Reservation, etc.
│           └── schemas.ts    # Validation schemas (shared between API + widget)
│
├── openspec/                 # Product specs (source of truth for requirements)
└── research/                 # Market & pilot research
```

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Language | TypeScript | Full-stack type safety |
| Backend | Fastify | Lighter than NestJS for this scope |
| ORM | Drizzle | Type-safe, migration-first, PostgreSQL-native |
| Database | PostgreSQL 16 | Relational data fits perfectly, RLS for multi-tenant |
| Cache/Queue | Redis + BullMQ | Async jobs (reminders, engagement, campaigns) |
| Dashboard | React 19 + Vite + Tailwind + shadcn/ui | Modern, fast, great component library |
| Widget | Preact | Tiny bundle (<30KB), embeddable as IIFE |
| Marketing | React + Vite + Tailwind | Same stack as dashboard, quick to build |
| Monorepo | Turborepo + pnpm | Fast builds, workspace protocol |

## Data Flow

```
Guest → [Widget / WhatsApp] → API → PostgreSQL
                                 ↓
                              BullMQ → Reminders, Engagement, Campaigns
                                 ↓
Owner → Dashboard ← API (REST)
```

## Multi-Tenant Model

Shared database with `restaurant_id` FK on every table. PostgreSQL RLS policies scope all queries. Phase 1 is single-tenant (BFF Raanana), but schema is multi-tenant from day one.

## API Design

REST, JSON, versioned (`/api/v1/*`). Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/reservations/availability` | Open slots for date/party_size |
| POST | `/api/v1/reservations` | Create reservation |
| PATCH | `/api/v1/reservations/:id` | Modify reservation |
| DELETE | `/api/v1/reservations/:id` | Cancel reservation |
| GET | `/api/v1/reservations` | List (filter by date, status) |
| GET | `/api/v1/guests` | List guests |
| GET | `/api/v1/guests/:id` | Guest profile + history |
| POST | `/api/v1/guests` | Create guest |
| GET | `/api/v1/tables` | List tables |
| POST | `/api/v1/tables` | Create table |
| GET | `/api/v1/restaurants/:id/dashboard` | Dashboard snapshot |

## Future Extensions

- **WhatsApp gateway** (Phase 1b): Baileys module under api, same domain services
- **AI agent** (Phase 1b): Claude Sonnet/Haiku, tool-use pattern
- **Loyalty/Gamification** (Phase 2): Growth tables already in schema
- **Campaigns/Engagement** (Phase 2): BullMQ workers
- **Multi-restaurant admin** (Phase 3): Separate admin app or role-gated in dashboard
