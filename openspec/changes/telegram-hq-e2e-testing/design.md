## Overview

Telegram becomes the temporary WhatsApp test surface. The target is not just API correctness; it is the full customer journey:

`Telegram customer message -> Jake Hebrew response -> OpenSeat API action -> dashboard/owner visibility -> customer confirmation`

## Tenant strategy

### OpenSeat HQ sandbox

`OpenSeat HQ` is the default test tenant for all new customer-flow tests.

It is cloned from the BFF structure but has clean operational data:

- tables copied from BFF
- hours copied from BFF
- brand/config copied from BFF baseline where useful
- no guests
- no reservations
- no waitlist
- no loyalty transactions
- no reward claims

### BFF live tenant

BFF should not be used for noisy E2E testing once OpenSeat HQ exists.

If BFF needs a fresh start, delete only operational data unless Sione explicitly asks to delete the tenant itself. Preserve tables/admin/config by default.

Recommended deletion order if confirmed:

1. `challenge_progress`
2. `reward_claims`
3. `loyalty_transactions`
4. `visit_logs`
5. `engagement_jobs`
6. `campaigns`
7. `challenges`
8. `conversations`
9. `waitlist`
10. `reservations`
11. `guests`

`rewards` should be a separate decision because active reward templates are useful for membership testing.

## Telegram routing

Use the OpenSeat Telegram group:

- General topic (`thread_id=1`) for customer-facing Hebrew tests
- BFF Owner topic (`thread_id=17`) for owner notification verification
- Reports topic (`thread_id=20`) for structured test summaries if needed

Until WhatsApp access lands, every Telegram General test should be treated like a WhatsApp customer chat.

## Test execution method

Each manual test case should record:

- test id
- customer prompt
- expected language/tone
- required data fields collected
- expected API/database result
- expected dashboard result
- expected owner notification, if relevant
- pass/fail
- notes: Hebrew quality, edge-case behavior, bugs

## Hebrew quality bar

Customer-facing Hebrew must be:

- native Israeli conversational Hebrew
- short and chat-native
- confident host energy
- no formal/corporate phrasing
- no awkward translation from English
- no repeated questions for already-given info
- no internal errors, IDs, stack traces, or API wording

Bad:

> ההזמנה שלך אושרה בהצלחה. מספר אישור...

Good:

> מעולה, שמרתי לך שולחן ל-4 בחמישי ב-20:00. נתראה 🍻

## Reservation verification

For every reservation created from Telegram:

- source should be `telegram`
- guest should be created or matched correctly
- reservation belongs to `OpenSeat HQ`, not BFF
- date/time/party size match the conversation
- dashboard Today/Reservations reflects the record
- owner notification includes guest name, party size, date/time, and source/context

## Membership verification phase

Membership is phase two of the same test plan.

Start only after:

- create reservation passes
- cancellation passes
- modification passes
- waitlist/no-availability passes
- returning guest recognition passes

Then test:

- balance lookup
- active rewards
- claim/redeem
- birthday/celebration
- referral
- comeback
- host perk for 6+ guests
- points/stamps after completed visit

## Risks

- Telegram tests can accidentally hit BFF if restaurant resolution is not explicit.
- BFF wipe can remove useful reward/membership setup if rewards are included.
- Reservation terminal states (`completed`, `cancelled`, `no_show`) have side effects and should not be reversed casually.
- Membership copy can become too marketing-ish; keep it hospitality-first.
