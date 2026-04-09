# OpenSeat — Product Roadmap

## Phase 1: Starter MVP (Web-First) — DONE
Core reservation product — API, dashboard, booking widget, marketing site.

| Deliverable | Status |
|-------------|--------|
| Monorepo scaffold (Turborepo + pnpm) | Done |
| Architecture + MVP scope docs | Done |
| DB schema (Drizzle, 21 tables) + 8 migrations | Done |
| Fastify API — reservations, guests, tables, availability | Done |
| Dashboard — Today, Reservations, Guests, Settings, Waitlist | Done |
| Booking Widget — embeddable Preact bundle (<25KB) | Done |
| Marketing Site — bilingual landing page | Done |
| BFF Raanana pilot data loaded | Done |

## Phase 1.5: Pilot-Ready Polish — DONE (Sprint 3)

| Deliverable | Status |
|-------------|--------|
| JWT authentication on all API routes | Done |
| Role-based access (admin/employee/super_admin) | Done |
| Multi-tenant enforcement + super-admin context switching | Done |
| Settings hours/table/branding editor | Done |
| Reservation lifecycle (confirm/seat/complete/cancel/no-show) | Done |
| Waitlist service + auto-match on cancellation | Done |
| Guest CRM — profiles, tags, notes, insights | Done |
| Dashboard white-label (palette, branding, feature toggles) | Done |
| E2E test runner (21 tests, full flow) | Done |
| CI/CD workflows (type-check, smoke, deploy) | Done |
| SSL/HTTPS | Blocked (needs domain) |

## Phase 1b: AI Agent + Telegram — IN PROGRESS

| Deliverable | Status |
|-------------|--------|
| Hermes Agent framework on VPS | Done |
| Agent service with tool-calling loop | Done |
| Reservation tools (check, create, cancel, list) | Done |
| Language detection (Hebrew/English/Arabic) | Done |
| Conversation context in Redis (24h TTL) | Done |
| Telegram group configured (General/Owner/Reports) | Done |
| Dashboard help chat (OpenRouter) | Done |
| Cron jobs (daily summary, win-back) | Done |
| Customer-facing Telegram bot | In Progress |
| WhatsApp gateway (Baileys) | Parked |

## Phase 2: Growth Package (CRM + Loyalty + Automation) — MOSTLY DONE

| Deliverable | Status |
|-------------|--------|
| Loyalty engine — points, stamps, tiers (Bronze/Silver/Gold) | Done |
| Rewards catalog + claim codes + redemption | Done |
| Gamification — streaks, challenges, referrals | Done |
| Membership club UX (חבר מועדון) | Done |
| Visit logging + guest insights | Done |
| Feedback collection + sentiment summary | Done |
| Engagement automation — thank-you, review, birthday, win-back | Done |
| Campaign manager — audience segments, templates, scheduling | Not started |
| Analytics dashboard — retention, CLV, campaign ROI | Not started |

## Phase 3: Scale + Monetize

- Row-level security for tenant isolation
- Package enforcement middleware (Starter vs Growth)
- Restaurant onboarding wizard
- Billing — PayPlus (Israel) + Stripe (international)
- Central admin console

## Future

- Voice/phone reservation handling
- POS integration (Tabit, others)
- Instagram DM intake
- Mobile app for owners
- AI table yield optimization
- Arabic + Russian language support
