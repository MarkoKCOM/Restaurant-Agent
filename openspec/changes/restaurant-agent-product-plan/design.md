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
WhatsApp:    WhatsApp Cloud API (Meta Business Platform) — free tier: 1,000 service conversations/month
Widget:      Preact (tiny bundle for embeddable widget)
Dashboard:   React + Vite + TailwindCSS (owner-facing)
Hosting:     Single VPS (pilot) → containerized (scale)
```

### 2. WhatsApp Integration Approach

**Decision:** WhatsApp Cloud API (Meta Business Platform) directly, not a third-party BSP

**Rationale:**
- Free tier includes 1,000 service-initiated conversations/month (enough for pilot)
- Direct integration means no middleman fees (BSPs like Twilio charge $0.005-$0.05/message)
- We control the full message flow and can optimize for our use case
- Alternative considered: Twilio WhatsApp — simpler setup but adds $0.005-$0.05/message cost that kills our pricing model
- Alternative considered: 360dialog — good BSP but unnecessary layer for our needs

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

### 7. Pricing Validation

| | **Sable Starter** | **Sable Growth** |
|--|--|--|
| **Price (IL)** | ₪149/mo | ₪449/mo |
| **Price (US)** | $39/mo | $119/mo |
| **Annual discount** | ₪1,490/yr (save 2 months) | ₪4,490/yr (save 2 months) |
| **Free trial** | 14 days | 14 days |
| **Per-cover fees** | Never | Never |
| **Seats (max)** | 80 | Unlimited |
| **WhatsApp conversations** | 500/mo included | 2,000/mo included |
| **Extra conversations** | ₪0.30 each | ₪0.20 each |

**Cost structure per restaurant (estimated):**
- WhatsApp Cloud API: ~$0-15/mo (1,000 free service conversations)
- Claude API (Sonnet/Haiku): ~$5-20/mo depending on volume
- Infrastructure (shared): ~$2-5/mo per restaurant at scale
- **Total COGS: ~$10-40/mo per restaurant**
- **Gross margin: ~65-80%**

Compared to market:
- Ontopo: Free (but no CRM/AI — not a real competitor)
- Tabit reservations: Bundled with POS, estimated ₪300-600/mo
- OpenTable Basic: $149/mo + $1.50/cover
- SevenRooms: ~$499/mo+
- **Sable Starter is the cheapest non-free option with AI capabilities**

## Risks / Trade-offs

**[WhatsApp Business API approval] →** Meta requires business verification and can take 2-4 weeks. For pilot, we can use the test/sandbox mode first, then apply for production approval. Mitigation: start the verification process immediately.

**[LLM cost at scale] →** If a restaurant gets 1,000+ conversations/month, Claude API costs could eat margin. Mitigation: use Haiku for classification (cheap), Sonnet only for response generation. Cache common Q&A responses. Consider fine-tuned smaller model later.

**[Hebrew AI quality] →** Hebrew NLU is less mature than English in most models. Mitigation: Claude handles Hebrew well; build a test suite of common Hebrew reservation phrases to validate. Have the pilot restaurant owner test extensively.

**[WhatsApp template approval] →** Template messages need Meta approval, which can be slow. Mitigation: prepare all templates early, start with generic approved templates, iterate.

**[Pilot restaurant dependency] →** If the pilot restaurant isn't actively engaged, we can't validate. Mitigation: set clear expectations, provide hands-on onboarding, check in weekly.

**[Scope creep to Growth before Starter is solid] →** Risk of building loyalty/gamification before reservations work perfectly. Mitigation: hard phase gate — Starter MVP must be stable for 2 weeks before starting Growth features.

## MVP Pilot Plan

### What we need from the pilot restaurant:
1. Restaurant name, address, hours, menu (even a photo of the physical menu)
2. Table layout — how many tables, how many seats each
3. Current reservation volume (how many per day/week)
4. WhatsApp Business number (or willingness to set one up)
5. Owner's WhatsApp for notifications
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

1. **WhatsApp Business number** — Does the pilot restaurant have one, or do we register a new one?
2. **Menu format** — Will they provide a structured menu (spreadsheet) or do we need to OCR a physical menu?
3. **Table layout** — Do they have a floor plan or do we create one from scratch?
4. **Brand name validation** — Is "Sable" the final name? Need to check domain availability and trademark.
5. **Billing for pilot** — Free during pilot? How long is the pilot period?
6. **POS integration priority** — If the pilot restaurant uses Tabit, should we consider basic POS integration earlier?
