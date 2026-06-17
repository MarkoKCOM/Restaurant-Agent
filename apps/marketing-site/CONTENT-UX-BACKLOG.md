# Marketing Site — Content / UX Fix Backlog

Tracked fixes for copy, logic, and UI/UX of the marketing site.
Items marked **🟢 Ready** are well-specified and can be built; items marked
**🟡 Needs decision** have an open question to resolve first.

Created: 2026-06-16 · **Implemented in PR #55** (2026-06-16) — all items below done across HE/EN/AR.

## Resolved decisions (were the open questions)
1. **Bookings:** "auto table assignment" replaced with "Answers questions, sends menu & photos" (concierge framing).
2. **Loyalty:** one-liners set — "A membership club that brings them back"; features: points/tiers/perks, games/streaks/challenges, collects feedback after each visit, member-get-member referrals.
3. **Pricing:** prices kept identical, only the tier labels changed to 120 / 200 / 400 / 400+.

4. **Contact form:** the "Seats" dropdown now renders from the localized pricing tiers (120 / 200 / 400 / 400+), so it stays in sync across HE/EN/AR.

---

## 1. Layout / spacing
- [x] 🟢 Reduce the dead space between the **main hero title and the header** (too much gap at the top).
- [x] 🟢 Reduce the dead space **between sections** further — the earlier `clamp()` pass (#32) helped but it's still too airy.

## 2. Navbar / header
- [x] 🟢 Remove the **"Live demo"** nav link (everywhere it appears in the header/nav).
  - Note: decide whether the demo *section* itself stays (see §6) — this is only about the nav link.

## 3. Modules section
- [x] 🟡 **Bookings → "Concierge".** Reframe so it reads as the restaurant's concierge / customer support:
  - The WhatsApp bot acts as concierge + support: manages **orders and reservations**, answers **questions**, sends **images** and the **menu**.
  - Mention the **website widget** as another channel.
  - **Open question:** "auto table assignment" should be replaced with a better capability/framing — *what?* (to discuss).
- [x] 🟡 **Loyalty → "Membership club".** Reframe as the **retention module**:
  - It's the component that **talks to customers**, **collects feedback from visits**, and runs the **games / rewards**.
  - Most of the content exists, but the **one-liners need to be tighter** (exact wording to discuss).

## 4. Pricing
- [x] 🟢 **Re-label tiers** to: **up to 120 seats**, **up to 200**, **up to 400**, **400+**.
  - **Open question:** the price per tier — current prices are keyed to the old seat tiers (80/150/200/200+). Confirm the price for each new tier (120 / 200 / 400 / 400+).
- [x] 🟢 **Starter** includes: **Concierge** (reservations, menu, images, info, customer support), **Owner dashboard**, **Reservation widget**, **Guestbook**.
- [x] 🟢 **Loyalty** includes: **Retention mechanism**, **Birthday**, **Guestbook gamification**, **"Membership club"**.
  - Remove the separate "automatic birthday and win-back" bullets — those are part of the retention / membership club. Keep it high-level, don't go in depth.

## 5. Add-ons
- [x] 🟢 Combine **Inventory + Supplier** into a single **"Full restaurant integration"** super add-on at **₪499/month**.
  - Rationale: it can't be done partially — it needs full access + integration with the restaurant's systems, so it's sold as one larger add-on rather than piecemeal.

## 6. Demo section (transparency fix — currently misleading)
- [x] 🟢 Make the demo **accurate**:
  - The booking flow shown is how the **website widget** works — **not WhatsApp**. WhatsApp is a **chat** experience, not this step UI.
  - The widget is a **pop-up style** overlay; it does **not** take over the whole screen.
  - Keep the phone mockup (it looks good) but label/frame it honestly so it doesn't imply WhatsApp = this screen flow.

## 7. "Talk to us" / contact
- [x] 🟢 Replace the **"15 minutes, no fluff"** copy with something **more professional**.

---

## Open questions to resolve (blockers for the 🟡 items)
1. **Modules / Bookings:** what replaces "auto table assignment" as a headline capability?
2. **Modules / Loyalty:** agree the exact one-liners for the membership-club framing.
3. **Pricing:** the price for each new seat tier (up to 120 / 200 / 400 / 400+).

## Notes
- Copy lives in the `I18N` map in `apps/marketing-site/src/LandingPage.tsx` (HE primary, plus EN + AR — all three must be updated for each copy change).
- Section layout/spacing is inline `clamp(...)` padding in the same file.
- Pricing tiers/plans: the `tiers` and `plans` arrays per language in `LandingPage.tsx`.
