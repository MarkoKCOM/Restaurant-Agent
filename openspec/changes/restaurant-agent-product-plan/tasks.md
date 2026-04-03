## 1. Project Setup

- [ ] 1.1 Initialize Node.js/TypeScript project with Fastify, Drizzle ORM, BullMQ
- [ ] 1.2 Set up PostgreSQL database and Redis on the VPS
- [ ] 1.3 Create Drizzle schema for core tables: restaurants, tables, guests, reservations, waitlist, conversations
- [ ] 1.4 Create Drizzle schema for Growth tables: loyalty_transactions, rewards, reward_redemptions, campaigns, engagement_jobs, challenges, challenge_progress
- [ ] 1.5 Set up database migrations and seed script with test restaurant data
- [ ] 1.6 Configure environment variables (.env) — database URL, Redis, WhatsApp credentials, Claude API key
- [ ] 1.7 Set up project linting (ESLint + Prettier) and basic CI

## 2. WhatsApp Gateway

- [ ] 2.1 Register WhatsApp Cloud API app on Meta Business Platform and configure webhook
- [ ] 2.2 Implement webhook endpoint to receive and verify inbound WhatsApp messages
- [ ] 2.3 Implement outbound message sender — template messages and session replies
- [ ] 2.4 Implement language detection from inbound messages (Hebrew, English, Arabic, Russian)
- [ ] 2.5 Create WhatsApp message templates and submit for Meta approval: reservation confirmation, reminder, cancellation, daily summary, thank-you, review prompt, loyalty update, campaign
- [ ] 2.6 Implement conversation context store in Redis (24-hour TTL per guest thread)
- [ ] 2.7 Implement media handling — receive and store images/documents attached to guest profiles

## 3. Restaurant Agent Core

- [ ] 3.1 Implement agent loop: receive message → classify intent (Haiku) → route to tool → generate response (Sonnet) → send via WhatsApp
- [ ] 3.2 Define all agent tools as Claude function-calling tool schemas (reservation, guest, communication, knowledge base tools)
- [ ] 3.3 Implement intent classifier using Claude Haiku with intents: reservation, inquiry, loyalty, complaint, compliment, general, unknown
- [ ] 3.4 Implement restaurant knowledge base — load menu, hours, policies, FAQ into searchable context
- [ ] 3.5 Implement agent personality system — load tone/greeting/style config per restaurant and inject into system prompt
- [ ] 3.6 Implement conversation handoff to human — escalation trigger, owner notification with full context
- [ ] 3.7 Implement multi-language response generation — ensure agent responds in the detected language
- [ ] 3.8 Implement owner notification system — alerts for new reservations, cancellations, no-shows, complaints, escalations

## 4. Reservation Engine

- [ ] 4.1 Implement check_availability tool — query open slots for given date/time/party_size against table map and existing reservations
- [ ] 4.2 Implement create_reservation tool — validate, assign table (smallest fit), create record, trigger confirmation message
- [ ] 4.3 Implement modify_reservation tool — validate new params against availability, update record, send update confirmation
- [ ] 4.4 Implement cancel_reservation tool — mark cancelled, free table, notify waitlist if applicable
- [ ] 4.5 Implement table management — table map CRUD, combinability rules, zone assignment
- [ ] 4.6 Implement auto table assignment algorithm — smallest table that fits, combinable table merging for large parties
- [ ] 4.7 Implement waitlist — add to waitlist, auto-notify on cancellation match, 15-minute hold expiry
- [ ] 4.8 Implement no-show tracking — mark no-show, increment guest counter, alert on repeat offenders (3+)
- [ ] 4.9 Implement operating hours and special dates — per-weekday hours, holiday closures, private events
- [ ] 4.10 Implement reservation reminders — BullMQ scheduled job 3 hours before reservation, send WhatsApp reminder with confirm/cancel
- [ ] 4.11 Implement daily summary — BullMQ scheduled job at closing time, compile stats, send to owner via WhatsApp

## 5. Web Booking Widget

- [ ] 5.1 Create Preact embeddable widget — date picker, time slot selector, party size, name, phone input
- [ ] 5.2 Implement real-time availability API endpoint for the widget
- [ ] 5.3 Implement widget → reservation API flow — create reservation, show confirmation
- [ ] 5.4 Implement customizable branding — owner sets primary color, logo, welcome message via config
- [ ] 5.5 Implement mobile-responsive layout with touch-friendly pickers
- [ ] 5.6 Build widget embed script — single `<script>` tag that restaurant adds to their website
- [ ] 5.7 Generate Google Business Profile "Reserve" direct link

## 6. Guest CRM (Growth)

- [ ] 6.1 Implement automatic guest profile creation on first booking (from any channel)
- [ ] 6.2 Implement visit history logging — auto-log on reservation completion with all details
- [ ] 6.3 Implement guest preferences storage — dietary restrictions, seating preference, favorites, occasion notes
- [ ] 6.4 Implement preference surfacing — show preferences and visit history when guest arrives or makes new reservation
- [ ] 6.5 Implement auto-tagging — tag guests as new/returning/regular/VIP based on visit count thresholds
- [ ] 6.6 Implement guest search and filtering — by tags, visit frequency, recency, spend, tier, custom filters
- [ ] 6.7 Implement guest merge/deduplication — detect same phone across channels, offer merge
- [ ] 6.8 Implement data export and GDPR deletion flow

## 7. Loyalty Engine (Growth)

- [ ] 7.1 Implement digital stamp card — configurable threshold, auto-stamp on visit completion, WhatsApp progress notification
- [ ] 7.2 Implement points system — configurable earning rules (per visit, per guest, per spend), award on visit completion
- [ ] 7.3 Implement reward catalog — CRUD for rewards (name, points cost, description), redemption code generation
- [ ] 7.4 Implement reward redemption — deduct points, generate unique code, notify staff
- [ ] 7.5 Implement VIP tiers — Bronze/Silver/Gold with configurable thresholds, auto-promotion, perks config
- [ ] 7.6 Implement points balance and loyalty status WhatsApp tool — guest can ask "what's my balance?"
- [ ] 7.7 Implement referral system — generate unique referral link/code, track referrals, award both parties on first visit

## 8. Gamification (Growth)

- [ ] 8.1 Implement visit streaks — track consecutive weeks with visit, bonus multiplier, streak broken notification
- [ ] 8.2 Implement challenges — owner creates time-limited challenges, track progress per guest, award on completion
- [ ] 8.3 Implement achievements — permanent badges (first visit, 10th visit, tried tasting menu, etc.)
- [ ] 8.4 Implement social sharing templates — branded images for tier promotions, challenge completions, streak milestones

## 9. Engagement Automation (Growth)

- [ ] 9.1 Implement post-visit thank-you — BullMQ job triggered on visit completion, respects quiet hours
- [ ] 9.2 Implement review solicitation — positive sentiment → Google Review link, negative → route to owner
- [ ] 9.3 Implement sentiment analysis on engagement responses using Claude Haiku
- [ ] 9.4 Implement complaint interception and service recovery workflow — detect negative response, notify owner, suggest recovery actions
- [ ] 9.5 Implement birthday automation — daily job checks upcoming birthdays, sends personalized greeting + offer
- [ ] 9.6 Implement anniversary automation — yearly trigger on first-visit anniversary
- [ ] 9.7 Implement win-back automation — 30/60/90 day escalation for lapsed guests

## 10. Campaign Manager (Growth)

- [ ] 10.1 Implement audience segmentation builder — filter guests by visit frequency, recency, tier, tags, spend
- [ ] 10.2 Implement campaign creation and scheduling — template text with personalization vars, schedule with quiet hours enforcement
- [ ] 10.3 Implement campaign delivery engine — BullMQ job to send WhatsApp template messages in batches
- [ ] 10.4 Implement campaign stats tracking — sent, delivered, read, replied counts
- [ ] 10.5 Implement campaign rate limiting — max 2/week, 4/month per guest
- [ ] 10.6 Implement opt-out handling — "STOP" keyword detection, immediate removal from campaigns
- [ ] 10.7 Create pre-built campaign templates — "We miss you", "Weekend special", "New menu", "Birthday month", "Loyalty milestone"

## 11. Analytics Dashboard (Growth)

- [ ] 11.1 Implement reservation analytics API — bookings, covers, occupancy by slot, cancellation/no-show rates
- [ ] 11.2 Implement retention analytics API — new vs returning, visit frequency, 30/60/90-day retention rate
- [ ] 11.3 Implement CLV calculation — per guest and per segment/tier
- [ ] 11.4 Implement campaign ROI tracking — attributed reservations and estimated revenue per campaign
- [ ] 11.5 Implement loyalty program analytics — active members, points issued/redeemed, tier distribution
- [ ] 11.6 Build React analytics dashboard page with charts (reservation heatmap, retention trend, tier distribution)
- [ ] 11.7 Implement WhatsApp daily morning summary (09:00) — yesterday's stats, today's bookings, notable guests

## 12. Multi-Restaurant & Billing

- [ ] 12.1 Implement row-level security (RLS) policies on all tables for tenant isolation
- [ ] 12.2 Implement package enforcement middleware — check restaurant package before allowing Growth-only endpoints
- [ ] 12.3 Implement restaurant onboarding wizard — step-by-step config: details, tables, hours, menu upload, agent personality, WhatsApp setup
- [ ] 12.4 Implement billing integration — PayPlus (Israel) and Stripe (international), monthly subscription, package upgrade/downgrade
- [ ] 12.5 Build central admin console — restaurant list, status, usage, billing, support

## 13. Pilot Deployment

- [ ] 13.1 Collect pilot restaurant info — name, address, hours, menu, table layout, policies, owner contact
- [ ] 13.2 Configure pilot restaurant in the system — onboard via wizard or manual setup
- [ ] 13.3 Set up WhatsApp Business number for pilot restaurant
- [ ] 13.4 Test full reservation flow end-to-end — WhatsApp booking in Hebrew and English, confirmation, reminder, cancellation
- [ ] 13.5 Test web widget on pilot restaurant's website (or a test page)
- [ ] 13.6 Test owner daily summary and alert notifications
- [ ] 13.7 Run 1-week soft launch with pilot restaurant, collect feedback, iterate
- [ ] 13.8 Validate name/brand — check domain availability for "Sable" or chosen name, secure domain

## 14. Branding & Landing Page

- [ ] 14.1 Finalize product name and register domain
- [ ] 14.2 Design logo and brand kit (colors, typography, tone guidelines)
- [ ] 14.3 Build landing page — value prop, package comparison, pricing, demo video, sign-up form
- [ ] 14.4 Create onboarding documentation for restaurant owners (Hebrew + English)
