## Context

We're building **Sable** — an AI-powered restaurant agent platform with two packages (Starter ₪149/mo, Growth ₪449/mo). The pilot is with a single restaurant in Israel. The platform must handle WhatsApp-based reservation management, guest CRM, loyalty/gamification, automated engagement, and analytics.

The Israeli restaurant market is a duopoly (Ontopo for bookings, Tabit for POS) with no AI-native unified solution. We're targeting the gap between free/basic tools and expensive US platforms ($500+/month).

Current state: greenfield — no existing codebase beyond market research.

## Goals / Non-Goals

**Goals:**
- Build an MVP that handles end-to-end reservation flow via WhatsApp for the pilot restaurant
- Design the architecture to support both Starter and Growth packages from day one
- Keep infrastructure costs minimal for pilot phase (single VPS, no expensive cloud services)
- Ship the Starter MVP in ~4 weeks, Growth features in ~4 weeks after
- Make the agent feel like a real restaurant team member, not a bot

**Non-Goals:**
- Voice/phone call handling (future phase)
- POS integration (future phase — too many systems to support initially)
- Instagram DM intake (future phase — WhatsApp + web widget is sufficient for MVP)
- Mobile app for owners (WhatsApp summaries + web dashboard is enough)
- Multi-language beyond Hebrew + English for MVP (Arabic + Russian later)
- Online payments / deposit collection (future phase)
- AI-powered table yield optimization (future phase)

## Decisions

### 1. Tech Stack

**Decision:** Node.js/TypeScript backend, PostgreSQL + Redis, React admin dashboard

**Rationale:**
- TypeScript gives type safety across the full stack
- PostgreSQL handles relational data (reservations, guests, tables) well and scales far beyond our needs
- Redis for caching, session state, rate limiting, and queue management
- React for the admin/owner dashboard (if we build one) — large ecosystem, easy to hire for
- Alternative considered: Python/FastAPI — would work but TS is better for a product that needs a frontend too
- Alternative considered: Supabase — too many constraints for a multi-tenant system

**Stack:**
```
Backend:     Node.js + TypeScript + Fastify (lighter than NestJS for this scope)
Database:    PostgreSQL 16 (via Drizzle ORM)
Cache/Queue: Redis + BullMQ (job queue for async tasks)
WhatsApp:    Baileys (WhatsApp Web multi-device) — zero cost, no Meta approval needed
Widget:      Preact (tiny bundle for embeddable widget)
Dashboard:   React + Vite + TailwindCSS (owner-facing)
Hosting:     Single VPS (pilot) → containerized (scale)
```

### 2. WhatsApp Integration Approach

**Decision:** Baileys (WhatsApp Web multi-device protocol) for MVP, migrate to WhatsApp Cloud API for scale

**Rationale:**
- **Zero cost** — no per-message fees, no Meta Business API subscription
- **No approval process** — no Meta business verification, no template approvals, instant setup
- **No restrictions** — send any message anytime, no 24-hour session window, no template-only outbound
- **Simple setup** — scan QR code with the restaurant's WhatsApp, done
- **Battle-tested** — Baileys is the most popular unofficial WhatsApp library (16k+ GitHub stars), used widely in Israel/LATAM for business bots
- Alternative considered: WhatsApp Cloud API — official but requires business verification (2-4 weeks), template approvals, per-conversation costs, and complex onboarding. Better for scale (100+ restaurants) but overkill for MVP/pilot
- Alternative considered: Twilio WhatsApp — $0.005-$0.05/message kills pricing model
- **Migration path:** When we hit ~50+ restaurants or need official business features (verified badge, catalog), migrate to WhatsApp Cloud API. The agent layer abstracts the transport, so switching is a driver change, not a rewrite

**Risk:** Meta can ban numbers using unofficial APIs. Mitigation: use a dedicated number per restaurant (not their personal number), implement rate limiting, avoid spam patterns. In practice, well-behaved bots on Baileys rarely get banned.

### 3. AI / LLM for Conversation

**Decision:** Use Claude API (Sonnet for conversation, Haiku for classification) via Anthropic SDK

**Rationale:**
- Best multilingual support (Hebrew, Arabic, English)
- Tool use / function calling for structured actions (create reservation, check availability)
- We already have Anthropic integration expertise from OpenClaw
- Cost: ~$0.003-$0.015 per conversation turn (Sonnet) — affordable at our scale
- Alternative considered: OpenAI GPT-4o — comparable but we know Anthropic better
- Alternative considered: Local LLM — too much infra overhead for pilot, latency issues

**Agent architecture:**
```
Guest Message → Language Detection → Intent Classification (Haiku)
  → Router:
    - reservation intent → Reservation Tool (structured)
    - inquiry intent → Knowledge Base RAG (menu, hours, policies)
    - loyalty intent → Loyalty Tool (structured)
    - complaint → Sentiment Analysis → Owner Alert
    - unknown → Escalation to Owner
  → Response Generation (Sonnet, in detected language)
  → WhatsApp Send
```

### 4. Multi-Tenant Data Model

**Decision:** Shared database with `restaurant_id` foreign key on every table (schema-level isolation)

**Rationale:**
- Simplest approach for pilot and early growth (<100 restaurants)
- Row-level security in PostgreSQL provides strong isolation without separate schemas
- Alternative considered: Schema-per-tenant — operational complexity not justified yet
- Alternative considered: Database-per-tenant — way overkill, expensive
- We add RLS policies so queries are always scoped to the restaurant

### 5. Agent Tools / Skills Architecture

**Decision:** Tool-use pattern — the agent has a defined set of tools it can call, organized by capability area

```
RESTAURANT AGENT TOOLS
======================

📅 Reservation Tools (Starter + Growth)
├── check_availability(date, time, party_size) → available slots
├── create_reservation(guest_id, date, time, party_size, notes) → reservation
├── modify_reservation(reservation_id, changes) → updated reservation
├── cancel_reservation(reservation_id, reason) → confirmation
├── get_today_summary() → daily overview
├── add_to_waitlist(guest_id, date, time_range, party_size) → waitlist entry
└── mark_no_show(reservation_id) → updated status

👤 Guest Tools (Starter: basic, Growth: full)
├── find_guest(phone | name) → guest profile
├── create_guest(name, phone, language, source) → guest profile
├── update_guest_preferences(guest_id, preferences) → updated profile
├── get_guest_history(guest_id) → visit history
├── add_guest_note(guest_id, note) → confirmation
└── search_guests(filters) → guest list                    [Growth]

💬 Communication Tools (Starter + Growth)
├── send_whatsapp(guest_id, message | template, params) → delivery status
├── send_owner_alert(type, message, context) → confirmation
└── send_daily_summary(restaurant_id) → confirmation

🏆 Loyalty Tools (Growth only)
├── get_points_balance(guest_id) → balance + tier
├── award_points(guest_id, amount, reason) → new balance
├── redeem_reward(guest_id, reward_id) → redemption code
├── get_loyalty_status(guest_id) → stamps, tier, streaks
├── check_referral(code) → referrer info
└── generate_referral_link(guest_id) → unique link

📣 Campaign Tools (Growth only)
├── create_campaign(audience_filter, template, schedule) → campaign
├── get_campaign_stats(campaign_id) → delivery/read/response stats
└── schedule_engagement(guest_id, type, trigger_time) → scheduled job

📊 Analytics Tools (Growth only)
├── get_reservation_stats(period) → metrics
├── get_retention_stats(period) → retention/churn
├── get_loyalty_stats(period) → program metrics
└── get_campaign_roi(campaign_id) → ROI metrics

🔧 Knowledge Base Tools (Starter + Growth)
├── search_menu(query) → matching items
├── get_restaurant_info(field) → info (hours, address, parking, etc.)
└── get_policies() → cancellation, dress code, etc.
```

### 6. Data Model

```
Core Tables
===========
restaurants
├── id, name, slug, description, cuisine_type
├── address, phone, email, website
├── timezone, locale
├── operating_hours (jsonb: {mon: {open, close}, ...})
├── special_dates (jsonb: [{date, status, message}])
├── agent_config (jsonb: {tone, greeting, personality})
├── package (starter | growth)
├── whatsapp_number, whatsapp_business_id
├── google_place_id
├── owner_phone, owner_whatsapp
└── created_at, updated_at

tables
├── id, restaurant_id
├── name (e.g., "T1", "Bar 3")
├── min_seats, max_seats
├── combinable_with (int[])
├── zone (e.g., "indoor", "patio", "bar")
└── is_active

menu_items
├── id, restaurant_id
├── name_he, name_en, description_he, description_en
├── price, category
├── allergens (text[]), dietary_tags (text[])
└── is_available

guests
├── id, restaurant_id
├── name, phone (unique per restaurant), email
├── language (he | en | ar | ru)
├── source (whatsapp | web | walk_in | referral)
├── first_visit_date, last_visit_date
├── visit_count, total_spend_estimate
├── tier (bronze | silver | gold)                    [Growth]
├── points_balance                                   [Growth]
├── stamps_count                                     [Growth]
├── streak_weeks                                     [Growth]
├── no_show_count
├── preferences (jsonb)
├── tags (text[])
├── notes (text)
├── opted_out_campaigns (boolean)
├── referral_code                                    [Growth]
├── referred_by (guest_id)                           [Growth]
└── created_at, updated_at

reservations
├── id, restaurant_id, guest_id
├── date, time_start, time_end (estimated)
├── party_size
├── table_ids (int[])
├── status (pending | confirmed | seated | completed | cancelled | no_show)
├── source (whatsapp | web | walk_in | phone)
├── notes
├── cancellation_reason
├── confirmation_sent_at, reminder_sent_at
└── created_at, updated_at

waitlist
├── id, restaurant_id, guest_id
├── date, preferred_time_start, preferred_time_end
├── party_size
├── status (waiting | offered | accepted | expired)
├── offered_at, expires_at
└── created_at

Growth-Only Tables
==================
loyalty_transactions
├── id, restaurant_id, guest_id
├── type (earn | redeem | bonus | referral)
├── points, reason
├── reservation_id (nullable)
└── created_at

rewards
├── id, restaurant_id
├── name_he, name_en
├── points_cost
├── description
└── is_active

reward_redemptions
├── id, restaurant_id, guest_id, reward_id
├── code (unique)
├── status (pending | redeemed | expired)
└── created_at, redeemed_at

campaigns
├── id, restaurant_id
├── name, template_text, audience_filter (jsonb)
├── status (draft | scheduled | sending | sent | cancelled)
├── scheduled_at, sent_at
├── stats (jsonb: {sent, delivered, read, replied, reservations})
└── created_at

engagement_jobs
├── id, restaurant_id, guest_id
├── type (thank_you | review_prompt | birthday | anniversary | win_back | streak_broken)
├── trigger_at
├── status (pending | sent | cancelled | responded)
├── response_sentiment (positive | negative | neutral | null)
└── created_at, sent_at

challenges                                           [Growth]
├── id, restaurant_id
├── name, description
├── type (visit_count | spend_target | custom)
├── target_value, reward_points
├── start_date, end_date
└── is_active

challenge_progress
├── id, challenge_id, guest_id
├── current_value
├── status (in_progress | completed | expired)
└── completed_at

conversations
├── id, restaurant_id, guest_id
├── whatsapp_thread_id
├── status (active | escalated | closed)
├── language
├── started_at, last_message_at
└── escalated_to (nullable, owner phone)
```

### 7. Pricing — Tiered by Restaurant Size

Pricing scales by **seats** (total seating capacity) — simple, objective, easy to verify.

#### Starter Package (Reservations + AI Bot)

| Tier | Seats | Price (IL) | Price (US) |
|------|-------|-----------|-----------|
| **Starter S** | Up to 40 seats | ₪99/mo | $29/mo |
| **Starter M** | Up to 80 seats | ₪149/mo | $39/mo |
| **Starter L** | Up to 150 seats | ₪249/mo | $69/mo |
| **Starter XL** | 150+ seats | ₪399/mo | $109/mo |

#### Growth Package (Full Suite — CRM + Loyalty + Gamification + Campaigns)

| Tier | Seats | Price (IL) | Price (US) |
|------|-------|-----------|-----------|
| **Growth S** | Up to 40 seats | ₪299/mo | $79/mo |
| **Growth M** | Up to 80 seats | ₪449/mo | $119/mo |
| **Growth L** | Up to 150 seats | ₪649/mo | $179/mo |
| **Growth XL** | 150+ seats | ₪899/mo | $249/mo |

#### Common Terms
- **Annual discount:** 2 months free (pay 10, get 12)
- **Per-cover fees:** Never
- **Free trial:** 14 days on any tier
- **Pilot:** Free for first restaurant (Sione's friend)

#### Why seats as the limiter:
- Easy to verify (count chairs)
- Correlates with revenue — bigger restaurant = more value from the tool = can pay more
- Not punitive like per-cover fees (you don't pay more for being busy)
- Simple to understand and communicate

**Cost structure per restaurant (estimated):**
- WhatsApp (Baileys): $0/mo (zero cost)
- Claude API (Sonnet/Haiku): ~$5-20/mo depending on conversation volume
- Infrastructure (shared): ~$2-5/mo per restaurant at scale
- **Total COGS: ~$7-25/mo per restaurant**
- **Gross margin: ~75-90%** (significantly better with Baileys vs Cloud API)

Compared to market:
- Ontopo: Free (but no CRM/AI — not a real competitor)
- Tabit reservations: Bundled with POS, estimated ₪300-600/mo
- OpenTable Basic: $149/mo + $1.50/cover
- SevenRooms: ~$499/mo+
- **We're the cheapest AI-powered option at every tier**

## Risks / Trade-offs

**[Baileys / WhatsApp ban risk] →** Meta can ban numbers using unofficial APIs. Mitigation: dedicated number per restaurant, rate limiting, no spam patterns. Well-behaved bots rarely get banned. If it becomes an issue at scale, migrate to WhatsApp Cloud API (the agent layer abstracts the transport).

**[LLM cost at scale] →** If a restaurant gets 1,000+ conversations/month, Claude API costs could eat margin. Mitigation: use Haiku for classification (cheap), Sonnet only for response generation. Cache common Q&A responses. Consider fine-tuned smaller model later.

**[Hebrew AI quality] →** Hebrew NLU is less mature than English in most models. Mitigation: Claude handles Hebrew well; build a test suite of common Hebrew reservation phrases to validate. Have the pilot restaurant owner test extensively.

**[Pilot restaurant dependency] →** If the pilot restaurant isn't actively engaged, we can't validate. Mitigation: set clear expectations, provide hands-on onboarding, check in weekly.

**[Scope creep to Growth before Starter is solid] →** Risk of building loyalty/gamification before reservations work perfectly. Mitigation: hard phase gate — Starter MVP must be stable for 2 weeks before starting Growth features.

## MVP Pilot Plan

### What we need from the pilot restaurant:
1. Restaurant name, address, hours
2. Menu — photo, PDF, or just tell us. Agent will learn it.
3. Table layout — how many tables, how many seats each
4. A phone number with WhatsApp for the bot (can be a spare SIM, ₪10/mo)
5. Owner's personal WhatsApp for notifications
6. Any special policies (cancellation, dress code, etc.)
7. 30 minutes for onboarding call

### Phase 1: Starter MVP (Weeks 1-4)
- Week 1: Database schema, WhatsApp webhook setup, basic agent loop
- Week 2: Reservation engine (create/modify/cancel), table management
- Week 3: Web booking widget, confirmations/reminders, daily summary
- Week 4: Testing with pilot restaurant, bug fixes, polish

### Phase 2: Growth MVP (Weeks 5-8)
- Week 5: Guest CRM (profiles, history, preferences)
- Week 6: Loyalty engine (stamps, points, tiers)
- Week 7: Engagement automation (thank-you, reviews, win-back)
- Week 8: Campaign manager, analytics, gamification basics

### Phase 3: Polish & Launch (Weeks 9-10)
- Owner onboarding wizard
- Billing integration (PayPlus for Israel)
- Landing page and marketing site
- Multi-restaurant support testing

## Open Questions

1. **Brand name** — "Sable" is placeholder. Need to brainstorm and pick final name, then secure domain.
2. **Pilot restaurant details** — Need the info listed above from Sione's friend.
3. **POS integration priority** — If the pilot restaurant uses Tabit, should we consider basic POS integration earlier?
4. **Dedicated phone number** — Does the friend have a spare SIM for the bot, or do we get one?
