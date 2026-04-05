# Sable - Product Brief

> The complete reference for what Sable is, what it does, how it works, and where it's going.
> Share this doc with designers, developers, investors, or anyone who needs the full picture.

---

## What is Sable?

Sable is an AI-powered restaurant management platform. It replaces expensive reservation systems (Ontopo, Tabit, OpenTable, SevenRooms) with a modern, affordable alternative that includes AI-native guest retention, loyalty, CRM, and WhatsApp automation.

**One line:** Your restaurant's smartest team member - reservations, guest CRM, loyalty, gamification, campaigns, and automation. All AI-powered, via WhatsApp and your website.

**Hebrew:** חבר הצוות הכי חכם של המסעדה שלך - מערכת מלאה לניהול מסעדה - הזמנות, CRM אורחים, נאמנות, גיימיפיקציה, קמפיינים ואוטומציה. הכל מונע AI, הכל בוואטסאפ ובאתר שלך.

**Target price:** $50-150/month (5-10x cheaper than SevenRooms/Resy)

---

## Who is it for?

- Independent restaurants (under 150 seats)
- Restaurant owners who want smart automation without paying premium prices
- Israel market first (Hebrew + English + Arabic), then international

**Pilot restaurant:** BFF Ra'anana, Israel (free, used to build and validate MVP)

---

## The Problem

| Market | Gap |
|--------|-----|
| Israel | Ontopo is free but booking-only (no CRM, no AI, no retention). Tabit is POS-focused, expensive, poor reservation UX. No unified solution. |
| US/International | AI features locked behind $500+/month platforms. Nothing affordable for independents. No WhatsApp-native booking anywhere. |

---

## Competitive Comparison

| Feature | Sable | Ontopo | Tabit | SevenRooms |
|---------|-------|--------|-------|------------|
| Online reservations | Yes | Yes | Yes | Yes |
| Booking widget | Yes | No | Yes | Yes |
| Owner dashboard | Yes | Partial | Yes | Yes |
| AI WhatsApp bot | Yes | No | No | No |
| Guest CRM | Yes | No | Partial | Yes |
| Loyalty program | Yes | No | No | Yes |
| Gamification | Yes | No | No | No |
| Marketing automation | Yes | No | No | Yes |
| Price (monthly) | From ₪499 | Free | ₪800+ | $500+ |
| Per-cover fees | Never | No | Yes | Yes |

---

## Product - 11 Tools

### 1. Reservation Engine
Full booking flow with intelligent table assignment.

- Create, modify, cancel reservations via API
- Real-time availability based on operating hours
- Smart table assignment: smallest-fit algorithm, tables can combine for larger parties
- Past-date rejection (timezone-aware, Asia/Jerusalem)
- Automatic reminders 3 hours before
- Status flow: pending - confirmed - seated - completed (or canceled/no-show)
- Phone validation (Israeli format: 0xx or +972)
- Zod schema validation on all inputs

### 2. Waitlist Management
Automatic queue when restaurant is fully booked.

- Auto-match when a table cancels (15-min hold window)
- First-come-first-served priority
- Automatic conversion to reservation on acceptance
- Notification sent to guest when slot offered
- Countdown timer (15 min) before slot expires

### 3. Owner Dashboard
Real-time control center for the restaurant.

**Pages:**
- Today - reservations for today + occupancy heatmap (30-min slots) + stats (bookings, covers, cancellations, no-shows)
- Reservations - list with date/status filtering, create/edit/delete, detail panel (slide-over)
- Guests - list with search, profile pages with full history and preferences
- Settings - restaurant details, operating hours (editable per day), table editor, widget branding

**UI:** React + Tailwind + shadcn/ui, RTL support (Hebrew layout), mobile-responsive, JWT auth

### 4. Booking Widget
Embeddable on any restaurant website with one line of code.

- Preact bundle (under 20KB gzipped)
- Flow: date picker - time slots (real-time availability) - party size - name + phone - confirmation
- Custom branding: primary color, logo, welcome text
- Mobile-first, responsive, RTL-ready
- Single `<script>` tag embed

### 5. Guest CRM
Full profile for every guest, everything in one place.

- Auto-created on first booking
- Fields: name, phone, email, dietary preferences, occasion notes
- Tracking: visitCount, lastVisitDate, first reservation date
- Auto-tags: new, returning, regular, VIP, at-risk, big-spender
- Staff notes and observations
- Insights: favorite dishes, visit frequency, day/time preference

### 6. Visit Tracking and Feedback
Know what happened at each visit.

- Tracks: dishes ordered, total spend, rating (1-5), text feedback, occasion
- Rating >= 4: prompt for Google review
- Rating <= 2: owner alert + "at-risk" tag
- Sentiment analysis on feedback
- Aggregated dietary profile from all visits

### 7. Loyalty Engine
Points, stamps, VIP tiers - all automatic.

- 10 points per visit, tier multipliers (Bronze x1, Silver x1.5, Gold x2)
- Stamp card: every 10 visits = 50 bonus points
- VIP tiers auto-assigned: Bronze (1+ visit), Silver (5+), Gold (15+)
- Reward catalog: create custom rewards (e.g., "free appetizer" = 100 pts)
- Guest asks on WhatsApp: "What's my balance?" - bot answers with points + tier + available rewards
- Full transaction history

### 8. Gamification
Turn visits into a game - give guests a reason to come back.

- Referral program: unique code per guest, 50 points to referrer + 25 to new guest
- Challenges: "Visit 3 times this week" with reward on completion
- Visit streaks: bonus for consecutive weekly visits (3, 5, 10, 20 weeks)
- Leaderboard: top 10 guests by points/streaks, monthly prize

### 9. Marketing Automation
The right message at the right time.

- Post-visit thank you: sent 2 hours after completion
- Review request: 24 hours after, only for 3+ visit guests
- Birthday greeting: auto-greeting + 100 bonus points
- Win-back: 30/60/90 days after last visit with escalating offers
- Quiet hours respected (22:00-08:00 local time)

### 10. WhatsApp AI Bot
Reservations, questions, loyalty - all via WhatsApp.

- Baileys library (open-source WhatsApp gateway)
- Claude API for conversation + intent classification
- Auto language detection: Hebrew, English, Arabic
- Bot loads full guest profile at start of every conversation
- Book, modify, cancel reservations in natural conversation
- Query loyalty balance, visit history
- Handoff to human when needed
- Owner daily summary via WhatsApp

**Example flow:**
```
Guest: "היי, אני רוצה להזמין שולחן בשישי בערב"
Bot: "בשישי בערב, כמה אנשים?"
Guest: "שלושה"
Bot: [checks availability] "יש לנו זמן ב-19:00 ו-19:30. איזה עדיף?"
Guest: "19:00"
Bot: [creates reservation] "מעולה! הזמנתי לך שולחן ל-3 ביום שישי ב-19:00. נשלח תזכורת."
```

### 11. Security and Privacy
Your data is protected.

- JWT authentication on all API routes
- Per-restaurant data isolation (restaurant_id FK on every table)
- PostgreSQL RLS policies (ready for multi-tenant)
- All secrets in .env files, never in code
- Zod validation on all inputs

---

## How It Works (4 Steps)

1. **Guest books** - via WhatsApp, your website, or phone. The booking enters the system.
2. **AI manages** - table assignment, confirmations, reminders - all automatic.
3. **Guest arrives** - staff sees everything on dashboard: profile, preferences, history.
4. **After the visit** - thank you message, review request, loyalty points. All automatic.

---

## Pricing

### Launch Offer (First 5 Restaurants)
**₪299 one-time** - Full reservation system. No monthly fee. Limited to 5 spots.
Includes: reservations, widget, dashboard, table management, operating hours.

### Starter Package
Reservations + widget + dashboard.

| Tier | Seats | Monthly |
|------|-------|---------|
| S | Up to 40 | ₪499 |
| M | Up to 80 | ₪699 |
| L | Up to 150 | ₪999 |
| XL | 150+ | ₪1,399 |

**Includes:** Web booking widget, owner dashboard, auto table assignment, operating hours + special dates, reservation reminders, waitlist with auto-match, no-show tracking, guest profiles (auto-created), occupancy heatmap.

### Standard Package
Everything in Starter + loyalty + CRM + automation.

| Tier | Seats | Monthly |
|------|-------|---------|
| S | Up to 40 | ₪799 |
| M | Up to 80 | ₪1,099 |
| L | Up to 150 | ₪1,499 |
| XL | 150+ | ₪1,999 |

**Additional features:** Full guest CRM, loyalty engine (points + stamps + VIP tiers), auto-tagging, visit tracking + insights, post-visit thank-you, birthday messages, win-back automation, review solicitation.

### Add-ons (Any Package)

| Add-on | Monthly | Description |
|--------|---------|-------------|
| WhatsApp AI Bot | ₪149 | AI-powered reservation bot, Hebrew/English/Arabic |
| Campaigns and Marketing | ₪99 | Audience segmentation, scheduled campaigns, A/B testing |
| Advanced Gamification | ₪79 | Challenges, streaks, leaderboard, lucky spin, group rewards |
| Analytics and Reports | ₪59 | Retention dashboard, CLV, campaign ROI, heatmaps |

### Terms
- Annual discount: pay 10 months, get 12 (17% savings)
- Free trial: 14 days, no credit card required
- No per-cover fees. Ever. Fixed monthly subscription only.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | TypeScript | Full-stack type safety |
| Backend | Fastify | Lightweight, fast |
| ORM | Drizzle | Type-safe, migration-first, PostgreSQL-native |
| Database | PostgreSQL 16 | Relational, RLS for multi-tenant |
| Cache/Queue | Redis + BullMQ | Async jobs (reminders, campaigns) |
| Dashboard | React 19 + Vite + Tailwind + shadcn/ui | Modern, fast, great components |
| Widget | Preact | Tiny bundle (under 20KB), embeddable IIFE |
| Marketing | React + Vite + Tailwind | Same stack as dashboard |
| WhatsApp | Baileys | Open-source, no API fees |
| AI | Claude API | Conversation + intent classification |
| Monorepo | Turborepo + pnpm | Fast builds, workspace protocol |

## Repository Structure

```
sable/
├── apps/
│   ├── api/              # Fastify backend (routes, services, DB, queue)
│   ├── dashboard/        # React owner dashboard
│   ├── booking-widget/   # Preact embeddable widget
│   └── marketing-site/   # React landing page
├── packages/
│   └── domain/           # Shared types + Zod schemas
├── openspec/             # Product specs (source of truth)
├── research/             # Market + pilot research
└── scripts/              # Deploy + test scripts
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/health | Health check |
| POST | /api/v1/auth/login | JWT authentication |
| GET | /api/v1/reservations/availability | Open slots for date/party_size |
| POST | /api/v1/reservations | Create reservation |
| PATCH | /api/v1/reservations/:id | Modify reservation |
| DELETE | /api/v1/reservations/:id | Cancel reservation |
| GET | /api/v1/reservations | List (filter by date, status) |
| POST | /api/v1/reservations/:id/no-show | Mark as no-show |
| GET | /api/v1/guests | List guests |
| GET | /api/v1/guests/:id | Guest profile + history |
| POST | /api/v1/guests | Create guest |
| GET | /api/v1/tables | List tables |
| POST | /api/v1/tables | Create table |
| GET | /api/v1/restaurants/:id/dashboard | Dashboard snapshot |
| PATCH | /api/v1/restaurants/:id | Update restaurant |

## Data Flow

```
Guest --> [Widget / WhatsApp] --> API --> PostgreSQL
                                   |
                                BullMQ --> Reminders, Engagement, Campaigns
                                   |
Owner --> Dashboard <-- API (REST)
```

---

## Roadmap

### Phase 1: Starter MVP - DONE
Core reservation product: API, dashboard, booking widget, marketing site. BFF Ra'anana pilot data loaded.

### Phase 1.5: Pilot-Ready Polish - IN PROGRESS
JWT auth, settings editors, reservation detail panel, widget branding, phone validation, past-date rejection. Remaining: waitlist auto-match, guest preferences, WhatsApp skeleton, dashboard login page, SSL.

### Phase 1b: WhatsApp + AI Agent
Baileys WhatsApp gateway, AI conversation agent (Claude), reservation tools, language detection, owner alerts, daily summary.

### Phase 2: Standard Package
Full CRM, loyalty engine, gamification, engagement automation, campaign manager, analytics dashboard.

### Phase 3: Scale + Monetize
Multi-restaurant RLS, package enforcement, onboarding wizard, billing (PayPlus Israel + Stripe international), admin console.

### Future
Voice/phone reservations, POS integration, Instagram DM, mobile app, AI table yield optimization, Arabic + Russian.

---

## Current Status (April 2026)

**Live deployments:**
- Marketing site: https://marketing-site-nine-chi.vercel.app
- Dashboard: https://dashboard-one-delta-38.vercel.app
- API: running on VPS port 3001 behind Nginx

**Infrastructure:** VPS with Node 22, PostgreSQL 16, Redis 7, Nginx reverse proxy, systemd service.

**What works end-to-end:**
- Guest books via widget - reservation created - shows in dashboard
- Owner views/manages today's reservations, changes status
- Auto table assignment (smallest fit)
- No-show tracking, repeat offender flagging
- Widget embeddable with single script tag
- Dashboard is responsive, RTL, mobile-friendly

**What's in progress:**
- Waitlist auto-match on cancellation
- Guest preference editor
- WhatsApp session manager skeleton

**Blockers:**
- SSL/HTTPS needs a domain pointed to VPS
- Need real BFF Ra'anana data (actual hours, table layout)

---

## Team

- **Product owner:** Sione (KaspaCom founder, Israel, Asia/Jerusalem timezone)
- **Dev agent:** Jake (AI, handles all restaurant agent development)
- **Pilot partner:** BFF Ra'anana owner (friend of Sione)

---

## Key Stats

- 24/7 AI availability
- 30 min saved per day for restaurant staff
- 0 per-cover fees
- 3x guest return rate (target)

---

## Marketing Copy (Hebrew)

### Hero
- Title: Sable
- Subtitle: חבר הצוות הכי חכם של המסעדה שלך
- Description: מערכת מלאה לניהול מסעדה - הזמנות, CRM אורחים, נאמנות, גיימיפיקציה, קמפיינים ואוטומציה. הכל מונע AI, הכל בוואטסאפ ובאתר שלך.
- Trust badge: מופעל ע״י AI - עובד 24/7 בלי הפסקות

### Tool Names (Hebrew)
1. מנוע הזמנות - מערכת הזמנות מלאה עם שיבוץ שולחנות אוטומטי
2. רשימת המתנה - ניהול אוטומטי של רשימת המתנה עם התאמה חכמה
3. דשבורד בעלים - מרכז שליטה בזמן אמת לכל מה שקורה במסעדה
4. ווידג׳ט הזמנות לאתר - ווידג׳ט הזמנות שנטען באתר שלך בשורת קוד אחת
5. CRM אורחים - פרופיל מלא לכל אורח - הכל במקום אחד
6. מעקב ביקורים ופידבק - דע מה קרה בכל ביקור - מנות, חשבון, דירוג, הערות
7. מנוע נאמנות - נקודות, חותמות, דרגות VIP - הכל אוטומטי
8. גיימיפיקציה - הפוך ביקורים למשחק - תן לאורחים סיבה לחזור
9. אוטומציית שיווק - הודעות אוטומטיות שנשלחות בזמן הנכון
10. בוט וואטסאפ AI - הזמנות, שאלות, נאמנות - הכל דרך וואטסאפ
11. אבטחה ופרטיות - הנתונים שלך מוגנים - גישה רק עם הרשאה

### Pricing Copy (Hebrew)
- מחירון - לפי מספר מושבים. ללא עמלה לסועד. 14 ימי ניסיון חינם.
- Starter: הזמנות + ווידג׳ט + דשבורד
- Standard: הכל ב-Starter + נאמנות + CRM + אוטומציה
- Annual: שלם 10 חודשים, קבל 12

### CTA (Hebrew)
- רוצה לנסות? 14 ימי ניסיון חינם. בלי כרטיס אשראי. בלי התחייבות.
- Button: דבר איתנו

### How It Works (Hebrew)
1. אורח מזמין - דרך וואטסאפ, האתר שלך, או טלפון - ההזמנה מגיעה למערכת
2. AI מנהל - שיבוץ שולחן, אישורים, תזכורות - הכל אוטומטי
3. אורח מגיע - הצוות רואה הכל בדשבורד - פרופיל, העדפות, היסטוריה
4. אחרי הביקור - תודה, בקשת ביקורת, נקודות נאמנות. הכל אוטומטי.

### FAQ (Hebrew)
- מה ההבדל בין Starter ל-Standard? - Starter כולל הזמנות, ווידג׳ט ודשבורד. Standard מוסיף CRM אורחים, נאמנות, גיימיפיקציה ואוטומציית שיווק.
- האם יש עמלה לסועד? - לא. אף פעם. מחיר חודשי קבוע בלבד.
- האם אפשר לנסות בחינם? - כן, 14 ימי ניסיון חינם ללא כרטיס אשראי.
- איך הבוט בוואטסאפ עובד? - הבוט מחובר למספר הוואטסאפ של המסעדה. אורחים שולחים הודעה רגילה והבוט מזהה את הכוונה - הזמנה, שאלה, נאמנות - ומטפל אוטומטית.
- האם המידע שלי מאובטח? - כן. כל הנתונים מוצפנים, גישה מוגבלת ל-JWT, והמערכת בנויה עם הפרדת נתונים לכל מסעדה.

---

*Last updated: April 5, 2026*
