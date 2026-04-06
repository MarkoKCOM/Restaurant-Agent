# OpenSeat — Product Roadmap

## Phase 1: Starter MVP (Web-First) — ✅ DONE
Core reservation product — API, dashboard, booking widget, marketing site.

| Deliverable | Status |
|-------------|--------|
| Monorepo scaffold (Turborepo) | Done |
| Architecture + MVP scope docs | Done |
| DB schema (Drizzle) + migrations | Done |
| Fastify API — reservations, guests, tables, availability | Done |
| Dashboard — Today, Reservations, Guests, Settings | Done |
| Booking Widget — embeddable Preact bundle | Done |
| Marketing Site — bilingual landing page | Done |
| BFF Raanana pilot data loaded | Done |

## Phase 1.5: Pilot-Ready Polish — 🔨 IN PROGRESS (Sprint 3)

| Deliverable | Status |
|-------------|--------|
| JWT authentication on all API routes | Done |
| Settings hours editor (editable per day) | Done |
| Settings table editor (add/edit/delete) | Done |
| Reservation detail panel (slide-over edit) | Done |
| Widget branding (dynamic colors/logo) | Done |
| Widget phone validation (Israeli format) | Done |
| Past-date rejection on reservations | Done |
| Waitlist auto-match on cancellation | In Progress (Jake) |
| Guest preference editor | In Progress (Jake) |
| WhatsApp session manager skeleton | In Progress (Jake) |
| SSL/HTTPS | Blocked (needs domain) |
| Dashboard login page + auth wrapper | Todo |

## Phase 1b: WhatsApp + AI Agent
Add Baileys WhatsApp gateway and AI conversation agent.

- Baileys connection + session management
- Agent loop: message → intent classify → tool call → respond
- Reservation tools wired to existing API
- Language detection (Hebrew/English/Arabic)
- Owner alerts + daily summary via WhatsApp
- Conversation context in Redis (24h TTL)

## Phase 2: Standard Package (CRM + Loyalty + Automation)
Full guest relationship management.

- Guest CRM — full profiles, history, preferences, segmentation
- Loyalty engine — stamps, points, tiers (Bronze/Silver/Gold), rewards
- Gamification — streaks, challenges, referrals, VIP progression
- Engagement automation — thank-you, review solicitation, birthday, win-back
- Campaign manager — audience segments, templates, scheduling, stats
- Analytics dashboard — retention, CLV, campaign ROI

## Phase 3: Scale + Monetize
Multi-restaurant, billing, onboarding.

- Row-level security for tenant isolation
- Package enforcement middleware (Starter vs Standard)
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
