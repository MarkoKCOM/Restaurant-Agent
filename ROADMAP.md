# Sable — Product Roadmap

## Phase 1: Starter MVP (Web-First) ← **NOW**
Core reservation product — API, dashboard, booking widget, marketing site.
No WhatsApp, no AI agent yet. Get the web flow rock solid.

| Deliverable | Status |
|-------------|--------|
| Monorepo scaffold (Turborepo) | Done |
| Architecture + MVP scope docs | Done |
| DB schema (Drizzle) + migrations | To Do |
| Fastify API — reservations, guests, tables, availability | To Do |
| Dashboard — Today, Reservations, Guests, Settings | To Do |
| Booking Widget — embeddable Preact bundle | To Do |
| Marketing Site — landing page | To Do |
| BFF Raanana pilot data loaded | Blocked (need owner info) |

## Phase 1b: WhatsApp + AI Agent
Add Baileys WhatsApp gateway and Claude-powered conversation agent on top of the working web product.

- Baileys connection + session management
- Agent loop: message → Haiku classify → tool call → Sonnet response → send
- Reservation tools wired to existing API
- Language detection (Hebrew/English)
- Owner alerts + daily summary via WhatsApp
- Conversation context in Redis (24h TTL)

## Phase 2: Growth Package
CRM, loyalty, gamification, campaigns, engagement automation, analytics.

- Guest CRM — full profiles, history, preferences, segmentation
- Loyalty engine — stamps, points, tiers (Bronze/Silver/Gold), rewards
- Gamification — streaks, challenges, badges, referrals, lucky spin, leaderboard
- Campaign manager — audience segments, template builder, scheduling, stats
- Engagement automation — thank-you, review solicitation, birthday, win-back
- Analytics dashboard — retention, CLV, campaign ROI, reservation heatmap

## Phase 3: Scale + Monetize
Multi-restaurant, billing, onboarding, admin console.

- Row-level security for tenant isolation
- Package enforcement middleware (Starter vs Growth)
- Restaurant onboarding wizard
- Billing — PayPlus (Israel) + Stripe (international)
- Central admin console
- Seat-based tier enforcement

## Future
- Voice/phone reservation handling
- POS integration (Tabit, others)
- Instagram DM intake
- Mobile app for owners
- AI table yield optimization
- Arabic + Russian language support
- Fine-tuned local LLM for cost reduction at scale
