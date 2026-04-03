## Why

Restaurants in Israel pay too much for fragmented tools that don't talk to each other — Ontopo for bookings (free but zero CRM), Tabit for POS (expensive, weak retention tools), plus separate systems for marketing, loyalty, and customer communication. Small restaurants (up to 80 seats) often use nothing but a paper notebook and WhatsApp. Meanwhile, US platforms like SevenRooms offer great CRM but cost $500+/month — out of reach for 90% of restaurants.

There's a clear gap: an AI-native restaurant agent that combines reservations, customer support, and retention in one affordable product. We have a pilot restaurant ready. The timing is right — WhatsApp Business API is mature, AI voice/chat is production-ready, and the "reservation wars" (DoorDash vs AmEx vs Booking Holdings) are creating market confusion that a simpler, cheaper alternative can exploit.

## What Changes

### Product: **Sable** (שֵׁיבְּל)

> *"Your restaurant's smartest team member"*

The name combines "table" with a nod to hospitality — works in English, sounds natural in Hebrew, short and memorable. Brand identity: warm, professional, AI-powered but human-feeling.

### Two Packages

**Sable Starter — ₪149/month ($39/month)**
- For small restaurants up to 80 seats
- WhatsApp reservation bot (Hebrew, English, Arabic)
- Embeddable web booking widget
- Table map and capacity management
- Automated confirmations, reminders, modifications
- No-show tracking and waitlist
- Google Business integration
- Daily summary to owner via WhatsApp
- 14-day free trial, no per-cover fees ever

**Sable Growth — ₪449/month ($119/month)**
- Everything in Starter
- Full guest CRM — profiles, visit history, preferences, spend
- Post-visit engagement — automated thank-you, review requests, personalized offers
- Loyalty program — digital stamp cards, points, rewards
- Gamification — visit streaks, referral rewards, VIP tiers (Bronze → Silver → Gold)
- Customer segmentation and targeted WhatsApp campaigns
- Birthday/anniversary auto-messages
- Review interception — prompt happy guests for Google reviews, route complaints to owner
- Analytics dashboard — retention rate, CLV, visit frequency, campaign ROI
- Multi-channel intake (WhatsApp + web + Instagram DM + phone)
- 14-day free trial

### Main Restaurant Agent
Each restaurant gets its own AI agent instance powered by the Sable platform. The agent:
- Has the restaurant's personality, menu knowledge, hours, and policies
- Handles all guest communication via WhatsApp (primary), web widget, and optionally voice
- Manages the reservation book, waitlist, and table assignments
- Tracks guest relationships and triggers retention workflows
- Reports to the owner/manager via WhatsApp summaries and alerts
- Learns from patterns (popular times, no-show risks, guest preferences)

## Capabilities

### New Capabilities
- `reservation-engine`: Core reservation management — booking, modification, cancellation, table assignment, capacity management, waitlist, no-show tracking
- `whatsapp-gateway`: WhatsApp Business API integration — inbound/outbound messaging, bot conversations, media handling, template messages, multilingual support
- `web-booking-widget`: Embeddable web widget for restaurant websites — real-time availability, booking form, confirmation flow
- `guest-crm`: Guest database and profiles — contact info, visit history, preferences, spend tracking, notes, segmentation, tagging
- `loyalty-engine`: Points/stamps system, reward tiers (Bronze/Silver/Gold), streak tracking, referral codes, reward redemption
- `gamification`: Challenges, achievements, leaderboards, streak bonuses, social sharing prompts, VIP tier progression
- `campaign-manager`: Targeted WhatsApp/SMS campaigns — audience segmentation, template creation, scheduling, A/B testing, delivery tracking, ROI measurement
- `engagement-automation`: Post-visit flows — thank-you messages, review requests, birthday/anniversary greetings, win-back campaigns for lapsed guests
- `review-management`: Review solicitation for happy guests, complaint interception, Google Reviews integration, sentiment tracking
- `analytics-dashboard`: Business intelligence — reservation stats, retention metrics, CLV, campaign ROI, peak hours, no-show rates, loyalty program performance
- `restaurant-agent-core`: Main agent identity, personality, restaurant knowledge base (menu, hours, policies, FAQ), conversation management, owner notifications, daily summaries
- `multi-restaurant`: Multi-tenant architecture — isolated agent instances per restaurant, shared platform infrastructure, central management console

### Modified Capabilities
_(none — greenfield project)_

## Impact

- **New codebase**: Full-stack application — backend API, database, WhatsApp integration, web widget, agent runtime
- **External dependencies**: WhatsApp Business API (Meta), Google Business API, payment processor (Stripe/PayPlus for Israeli market)
- **Infrastructure**: Database (PostgreSQL + Redis), message queue for async processing, agent runtime environment
- **Compliance**: GDPR-like privacy requirements, Israeli Privacy Protection Law, WhatsApp Business Policy compliance
- **Pilot**: First deployment with one restaurant — validates core reservation + WhatsApp flow before building Growth features
