# OpenSeat Owner Guide
## Dashboard & day-to-day restaurant operations

---

## Getting Started

### Logging In

1. Open the dashboard in your browser
2. Enter your email and password
3. You'll land on the **Today** page

> Your restaurant admin email/password are created during onboarding. Use the credentials assigned to your restaurant.

### Related membership docs

- `docs/MEMBERSHIP-FAQ.md` — member-facing answers you can reuse in chat, onboarding, or help content
- `docs/MEMBERSHIP-OPERATIONS-GUIDE.md` — operator playbook for running loyalty, referrals, and messaging responsibly

---

## Dashboard Pages

### Today (היום)

Your real-time command center for the day.

**What you see:**
- **Stats bar** — total reservations, covers (guests), cancellations, and no-shows for today
- **Occupancy heatmap** — visual 30-minute grid showing how full you are throughout the evening. Darker amber = busier
- **Table map** — each table with its current status (available / reserved / occupied)
- **Next up** — countdown to the closest upcoming reservation
- **Reservation list** — every booking for today with quick action buttons

**Actions you can take on each reservation:**
| Current Status | Available Actions |
|----------------|-------------------|
| Pending | Confirm, Cancel |
| Confirmed | Seat, Cancel, No-Show |
| Seated | Complete, No-Show |

Just click the action button next to any reservation. The system automatically updates guest visit counts, loyalty points, and tags when you complete or no-show a reservation.

---

### Reservations (הזמנות)

Full reservation management across any date.

**Features:**
- **Date picker** — navigate to any day (past or future)
- **Status filters** — filter by Pending, Confirmed, Seated, Completed, Cancelled, No-Show (each shows a count)
- **Search** — find reservations by guest name or phone number
- **Sort** — by time, name, party size, or status
- **Create new** — click "+" to manually create a reservation
- **Edit** — click any reservation to open the detail panel where you can change time, party size, notes, or status

**Tips:**
- Use the date picker to check tomorrow's bookings before closing up
- Filter by "Pending" at the start of your shift to confirm all upcoming reservations
- Cancelled reservations automatically trigger waitlist matching — if someone was waiting for that slot, they'll get an offer

---

### Waitlist (רשימת המתנה)

When you're fully booked, guests can join the waitlist instead of being turned away.

**How it works:**
1. Guest requests a time that's full — they're added to the waitlist with their preferred time range
2. When a cancellation opens a slot, the system automatically finds matching waitlist entries
3. You can click **"Offer Slot"** to send the offer to the guest
4. The guest has 15 minutes to accept before the offer expires
5. If accepted, it converts to a real reservation automatically

**Statuses:**
- **Waiting** (yellow) — guest is in queue
- **Offered** (blue) — slot offered, countdown running
- **Accepted** (green) — converted to reservation
- **Expired** (gray) — offer timed out

---

### Guests (אורחים)

Your guest CRM — every customer who's ever booked.

**Guest profile shows:**
- Name, phone, email
- Total visit count
- Loyalty tier (Bronze / Silver / Gold)
- Auto-tags: חדש (new, 0-2 visits), חוזר (returning, 3-9), קבוע (regular, 10-24), VIP (25+)
- Preferences: dietary restrictions, seating preference, language
- Full visit history (last 20 reservations)
- Loyalty points balance and stamp card progress

**Editing preferences:**
Click any guest to open their profile, then edit:
- **Dietary**: Kosher, Vegan, Vegetarian, Gluten-free
- **Seating**: Indoor, Outdoor, Bar
- **Language**: Hebrew, English, Arabic, Russian
- **Notes**: Free text (e.g., "always asks for corner table", "celebrating anniversary")

**Auto-tagging:**
The system automatically tags guests based on:
- Visit count (חדש → חוזר → קבוע → VIP)
- Lapsed status (>30 days since last visit)
- Spending patterns
- You can also add manual tags that won't be overwritten

---

### Settings (הגדרות)

**Restaurant Details** — name, phone, address

**Operating Hours** — toggle each day on/off, set open/close times:
| Day | Hours |
|-----|-------|
| Sunday | 17:30 - 00:30 |
| Monday - Thursday | 17:30 - 01:00 |
| Friday | 11:00 - 16:00 |
| Saturday | 19:00 - 01:00 |

**Tables** — add, edit, or remove tables. Each table has:
- Table name/number
- Min and max seats (e.g., T3 seats 2-4)
- Zone (main, patio, bar, etc.)
- Active/inactive toggle

**Widget Branding** — customize the booking widget:
- Primary color (default: amber #d97706)
- Logo URL
- Welcome text

**Feature Toggles** — enable/disable: Waitlist, Loyalty, Guest Notes, Occupancy Heatmap, Table Map

---

## Loyalty System

Points are earned automatically when you mark a reservation as "Complete".

The main places to manage it are:
- **Loyalty dashboard** — program snapshot, referral performance, active rewards, and reward strategy
- **Guest profile** — member balance, reward claims, streaks, and referral details for one guest
- **Settings / reward management** — reward catalog and feature toggles

**Points per visit:**
| Tier | Visits Required | Points Multiplier |
|------|----------------|-------------------|
| Bronze | 0+ | 10 pts/visit (1x) |
| Silver | 5+ | 15 pts/visit (1.5x) |
| Gold | 15+ | 20 pts/visit (2x) |

**Stamp Card:** 10-stamp card. Every completed visit = 1 stamp. Full card = 50 bonus points.

**Rewards:** You can create rewards in the system (e.g., "Free dessert" for 50 points, "10% off" for 100 points). Guests redeem through the agent or at the restaurant.

**Referrals / bring-a-friend:**
- Members can get a referral code
- New guests can be attributed to the member who brought them in
- The loyalty dashboard highlights referral advocates, referred guests, and referral-ready rewards so this flow is visible to operators

For the full playbook, see `docs/MEMBERSHIP-OPERATIONS-GUIDE.md`.

---

## Engagement (Automated Messages)

The system schedules automated messages to keep guests coming back:

| Message | When | Trigger |
|---------|------|---------|
| Thank you | 2 hours after visit | Every completed reservation |
| Review request | 24 hours after visit | Guests with 3+ visits |
| Birthday greeting | On birthday at 10:00 | Guest has birthday saved |
| Win-back (30 days) | 30 days since last visit | +20 bonus points |
| Win-back (60 days) | 60 days since last visit | +50 bonus points |
| Win-back (90 days) | 90 days since last visit | +100 points + free dessert |

> These messages will be delivered through WhatsApp/Telegram once the channels are fully connected. Currently they are logged and ready.

---

## The AI Agent

The OpenSeat AI agent handles customer conversations in Hebrew, English, and Arabic. It can:

- Check available time slots
- Create reservations
- Cancel reservations
- Add guests to the waitlist
- Answer questions about the restaurant (hours, address, phone)
- Recognize returning guests and their preferences

The agent uses your real-time availability data — it will never double-book a table.

**Testing:** Send messages in the Telegram group's General topic to test the agent flow.

---

## Daily Workflow

1. **Start of shift** — Open the **Today** page. Check stats and upcoming reservations.
2. **Confirm pending** — Go to Reservations, filter by "Pending", confirm or call guests.
3. **Seat arrivals** — As guests arrive, click "Seat" on their reservation.
4. **Complete visits** — When guests leave, click "Complete" (this triggers loyalty points + engagement messages).
5. **Handle no-shows** — Mark no-shows to track patterns and update guest profiles.
6. **Check waitlist** — If cancellations come in, the system auto-matches. Review and send offers.
7. **End of day** — Check tomorrow's reservations on the Reservations page.

---

## Quick Reference

| Action | Where |
|--------|-------|
| See today's bookings | Today page |
| Create a reservation | Reservations → "+" button |
| Find a guest | Guests → search by name or phone |
| Check if a slot is available | Reservations → pick date, look at the list |
| Edit restaurant hours | Settings → Operating Hours |
| Add/remove a table | Settings → Tables |
| Check loyalty points | Guests → click guest → Loyalty section |
| See waitlist | Waitlist page |
