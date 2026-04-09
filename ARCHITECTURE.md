# Architecture Overview

## Monorepo Layout

Turborepo + pnpm workspaces. Each app is independently buildable and deployable.

```text
openseat/
├── package.json              # Root — Turborepo scripts
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json        # Shared TS config
├── .env.example
├── CONVENTIONS.md            # Coding standards & rules
├── eslint.config.js          # ESLint flat config
├── .editorconfig
│
├── apps/
│   ├── api/                  # Backend — Fastify + Drizzle + BullMQ
│   │   ├── src/
│   │   │   ├── index.ts      # Server entry + BullMQ workers + cron scheduling
│   │   │   ├── env.ts        # Zod-validated env config
│   │   │   ├── db/
│   │   │   │   ├── schema.ts # Full Drizzle schema (21 tables, 11 enums)
│   │   │   │   ├── index.ts  # DB connection (pooled)
│   │   │   │   └── seed.ts   # BFF Ra'anana seed data
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts   # JWT + multi-tenant enforcement + role guards
│   │   │   ├── routes/       # 13 route files
│   │   │   │   ├── auth.ts           # Login, JWT generation
│   │   │   │   ├── reservations.ts   # CRUD + availability + walk-in
│   │   │   │   ├── guests.ts         # CRM profiles + full-profile
│   │   │   │   ├── tables.ts         # Table management
│   │   │   │   ├── restaurants.ts    # Settings + dashboard snapshot + table map
│   │   │   │   ├── loyalty.ts        # Points, stamps, tiers, rewards, claims
│   │   │   │   ├── gamification.ts   # Challenges, referrals, streaks
│   │   │   │   ├── waitlist.ts       # Queue + auto-match + offer/accept
│   │   │   │   ├── visits.ts         # Visit logging + insights
│   │   │   │   ├── engagement.ts     # Win-back campaigns
│   │   │   │   ├── chat.ts           # Dashboard help assistant (OpenRouter)
│   │   │   │   ├── agent.ts          # AI agent message/reset endpoints
│   │   │   │   └── admin.ts          # Super-admin multi-tenant ops
│   │   │   ├── services/     # 15 domain service files
│   │   │   │   ├── reservation.service.ts
│   │   │   │   ├── guest.service.ts
│   │   │   │   ├── loyalty.service.ts
│   │   │   │   ├── waitlist.service.ts
│   │   │   │   ├── challenge.service.ts
│   │   │   │   ├── engagement.service.ts
│   │   │   │   ├── visit.service.ts
│   │   │   │   ├── feedback.service.ts
│   │   │   │   ├── reward-claims.service.ts
│   │   │   │   ├── referral.service.ts
│   │   │   │   ├── membership-summary.service.ts
│   │   │   │   ├── table.service.ts
│   │   │   │   ├── summary.service.ts
│   │   │   │   ├── agent.service.ts   # AI agent loop (context + LLM + tools)
│   │   │   │   └── agent-tools.ts     # Tool definitions for AI agent
│   │   │   └── queue/
│   │   │       ├── index.ts           # BullMQ queue definitions (3 queues)
│   │   │       ├── reminder.worker.ts
│   │   │       ├── summary.worker.ts
│   │   │       └── engagement.worker.ts
│   │   └── drizzle/          # 8 migrations
│   │
│   ├── dashboard/            # Owner dashboard — React + Vite + Tailwind
│   │   └── src/
│   │       ├── App.tsx       # Router + route guards (role-based)
│   │       ├── i18n.tsx      # Hebrew/English translations
│   │       ├── hooks/
│   │       │   ├── useAuth.ts             # Auth state + role checks
│   │       │   └── useCurrentRestaurant.ts
│   │       └── pages/
│   │           ├── TodayPage.tsx           # Live ops dashboard
│   │           ├── ReservationsPage.tsx    # Full reservation management
│   │           ├── GuestDetailPage.tsx     # CRM + loyalty + membership
│   │           ├── GuestsPage.tsx          # Guest directory
│   │           ├── WaitlistPage.tsx        # Waitlist management
│   │           ├── SettingsPage.tsx        # Restaurant config + tables + branding
│   │           ├── HelpPage.tsx            # Guided help + AI chat
│   │           ├── LoginPage.tsx           # Auth
│   │           └── RestaurantPickerPage.tsx # Super-admin restaurant selector
│   │
│   ├── booking-widget/       # Embeddable widget — Preact (IIFE bundle, <25KB)
│   │   └── src/
│   │       ├── main.tsx      # Auto-mount + OpenSeatBooking.mount()
│   │       └── BookingWidget.tsx
│   │
│   ├── marketing-site/       # Landing page — React + Vite + Tailwind
│   │   └── src/
│   │       └── LandingPage.tsx  # Bilingual (Hebrew/English/Arabic)
│   │
│   └── e2e/                  # End-to-end test runner
│       └── src/
│           ├── test-runner.ts
│           └── api-client.ts
│
├── packages/
│   └── domain/               # Shared types, Zod schemas, access rules
│       └── src/
│           ├── types.ts           # All domain interfaces
│           ├── schemas.ts         # Zod validation schemas
│           ├── dashboard-access.ts # Role-based page access matrix
│           └── index.ts           # Barrel export
│
├── openspec/                 # Product specs (source of truth for requirements)
│   └── changes/              # 7 completed change proposals
├── scripts/                  # Deploy & test scripts
├── docs/                     # User-facing guides (owner, customer)
├── research/                 # Market & pilot research
└── skills/                   # Custom AI skills for Hermes agent
```

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Language | TypeScript | 5.8+ |
| Monorepo | Turborepo + pnpm | 2.5+ / 10.30+ |
| Backend | Fastify | 5.3 |
| ORM | Drizzle ORM | 0.43 |
| Database | PostgreSQL | 16 |
| Cache/Queue | Redis + BullMQ | 5.40 |
| Auth | JWT + bcrypt | jsonwebtoken 9.0 |
| Validation | Zod | 3.24 |
| Dashboard | React 19 + Vite 6 + Tailwind 4 | |
| Data Fetching | TanStack React Query | 5.75 |
| Routing | React Router | 7.5 |
| Widget | Preact | 10.25 |
| Marketing | React + Vite + Tailwind | Same as dashboard |
| Node.js | v22 LTS | |

## Data Flow

```
Guest → [Widget / Telegram / WhatsApp] → API (REST) → PostgreSQL
                                            ↓
                                         BullMQ Workers
                                    (reminders, summaries, engagement)
                                            ↓
Owner → Dashboard ← API (REST) ← PostgreSQL
         ↑
    AI Help Chat (OpenRouter)
```

## AI Agent Architecture

```
Customer message (Telegram/WhatsApp)
         ↓
    Hermes Agent (gpt-5.4 via Codex)
         ↓
    Agent Service → LLM with tools → Tool execution loop
         ↓                                    ↓
    Redis (conversation context)     Service layer (reservations, guests, etc.)
         ↓
    Response → Customer
```

**Tools available to the agent:** check_availability, create_reservation, cancel_reservation, get_reservations, join_waitlist, get_restaurant_info, get_guest_profile

## Multi-Tenant Model

Shared database with `restaurant_id` FK on every table. Auth middleware enforces tenant isolation on every request. Three roles:

| Role | Scope | Access |
|------|-------|--------|
| `admin` | Single restaurant | Full access to their restaurant |
| `employee` | Single restaurant | Today, Reservations, Waitlist only |
| `super_admin` | All restaurants | Platform-wide, can switch context via `x-restaurant-id` header |

## Deployment

| Component | Host | Details |
|-----------|------|---------|
| API | VPS (204.168.227.45) | Port 3001, systemd `openseat-api`, behind Nginx |
| Dashboard | Vercel | SPA, API proxied to VPS |
| Booking Widget | Vercel | Static IIFE bundle |
| Marketing Site | Vercel | SPA |
| Hermes Agent | VPS | Python gateway on port 8642 |
| PostgreSQL | VPS | Local, user `openseat`, db `openseat_db` |
| Redis | VPS | localhost:6379 |

## API Endpoints

### Public (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health`, `/api/v1/health` | Health check |
| GET | `/api/v1/reservations/availability` | Available time slots |
| GET | `/api/v1/restaurants`, `/api/v1/restaurants/:id` | Restaurant info |
| POST | `/api/v1/reservations` | Guest booking |
| POST | `/api/v1/waitlist` | Join waitlist |
| POST | `/api/v1/waitlist/:id/accept` | Accept offered slot |
| POST | `/api/v1/agent/*` | AI agent endpoints |
| POST | `/api/v1/feedback` | Guest feedback submission |

### Protected (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Get JWT token |
| GET/POST/PATCH/DELETE | `/api/v1/reservations/*` | Reservation management |
| GET/POST/PATCH | `/api/v1/guests/*` | Guest CRM |
| GET/POST/PATCH | `/api/v1/tables/*` | Table management |
| PATCH | `/api/v1/restaurants/:id` | Update settings |
| GET/POST | `/api/v1/loyalty/*` | Points, rewards, claims |
| GET/POST | `/api/v1/gamification/*` | Challenges, referrals, streaks |
| POST | `/api/v1/engagement/*` | Win-back campaigns |
| GET/POST | `/api/v1/visits/*` | Visit logging + insights |
| GET | `/api/v1/feedback/summary` | Feedback analytics |
| POST | `/api/v1/chat` | Dashboard AI help |
| GET/POST | `/api/v1/admin/*` | Super-admin operations |

## Database Schema (21 tables)

**Core:** restaurants, admin_users, tables, guests, reservations, waitlist, conversations
**Loyalty:** loyalty_transactions, rewards, reward_claims
**Gamification:** challenges, challenge_progress, referral_claims
**Engagement:** campaigns, engagement_jobs
**Tracking:** visit_logs

**11 PostgreSQL enums:** package, reservation_status, reservation_source, waitlist_status, guest_source, language, tier, admin_role, conversation_status, feedback_channel, reward_claim_status

## Queue System (BullMQ)

| Queue | Purpose | Schedule |
|-------|---------|----------|
| `reservation-reminders` | Pre-reservation reminders | On booking |
| `daily-summary` | Daily stats for each restaurant | 23:00 Asia/Jerusalem |
| `engagement` | Win-back, thank-you, birthday, review | 10:00 + on events |
