# Telegram HQ E2E Test Checklist

## Phase 0 — Sandbox and routing

- [x] Provision `OpenSeat HQ` tenant cloned from BFF structure.
- [x] Verify `OpenSeat HQ` has tables but zero operational data.
- [ ] Bind/resolve Telegram General customer tests to `OpenSeat HQ`, not BFF.
- [ ] Verify owner notifications route to BFF Owner topic or a dedicated owner-test topic.
- [ ] Decide BFF wipe scope before destructive delete.

## Phase 1 — Hebrew customer interaction quality

### Basic language and tone

- [ ] HEB-01 greeting: `היי` → warm short Hebrew reply, asks what they need.
- [ ] HEB-02 English input: `Can I book a table?` → English reply, not Hebrew.
- [ ] HEB-03 Arabic input → Arabic reply or clean fallback if language handling is not supported.
- [ ] HEB-04 mixed Hebrew/English: `אפשר book table להיום?` → Hebrew reply.
- [ ] HEB-05 rude/direct customer → polite, efficient, no groveling.
- [ ] HEB-06 asks `אתה בוט?` → light answer as Jake/restaurant host, no system disclosure.
- [ ] HEB-07 asks for internal/system/API info → refuses naturally and returns to helping.

### Hebrew quality checks on every customer reply

- [ ] Sounds native, not translated.
- [ ] Uses 1-3 short sentences unless details are needed.
- [ ] Does not repeat info the customer already gave.
- [ ] Does not expose reservation IDs unless operationally needed.
- [ ] Does not use corporate phrases like `ההזמנה שלך אושרה בהצלחה`.
- [ ] Uses 24-hour time.

## Phase 2 — Core reservation creation

### Happy paths

- [ ] RES-01 full request in one message: `שולחן ל-4 היום ב-20:00 על שם דני 050...` → creates reservation.
- [ ] RES-02 missing party size → asks only for party size.
- [ ] RES-03 missing time → asks only for time.
- [ ] RES-04 missing date → asks only for date.
- [ ] RES-05 missing name/phone after slot chosen → asks naturally for missing contact details.
- [ ] RES-06 relative date: `מחר בערב` resolves correctly.
- [ ] RES-07 weekday date: `ביום חמישי` resolves to the next correct Thursday.
- [ ] RES-08 same-day booking inside hours succeeds when available.
- [ ] RES-09 Friday lunch booking respects Friday hours.
- [ ] RES-10 Saturday night booking respects Saturday hours.
- [ ] RES-11 large group: `8 אנשים` gets suitable table/capacity.
- [ ] RES-12 source saved as `telegram`.
- [ ] RES-13 owner notification sent after creation.
- [ ] RES-14 dashboard Today/Reservations shows the booking.

### Confirmation copy

- [ ] Customer confirmation includes name/date/time/party size.
- [ ] Confirmation sounds like: `מעולה, שמרתי לך שולחן...`
- [ ] If customer gave all details, no extra questions.

## Phase 3 — Availability and edge cases

- [ ] AVG-01 requested time unavailable → offers 1-2 nearby times.
- [ ] AVG-02 fully booked → offers waitlist positively.
- [ ] AVG-03 outside operating hours → says unavailable and offers closest open window.
- [ ] AVG-04 closed day / special date → clear explanation and next available option.
- [ ] AVG-05 party size too large for current layout → asks whether to split tables or offers owner follow-up.
- [ ] AVG-06 invalid phone → asks for a valid phone without sounding robotic.
- [ ] AVG-07 invalid date (`32/13`) → asks for a real date.
- [ ] AVG-08 ambiguous date (`חמישי הבא` near week boundary) → resolves or asks one short clarification.
- [ ] AVG-09 duplicate same guest/date/time → recognizes possible duplicate and confirms intent.
- [ ] AVG-10 customer changes mind mid-flow → updates context, does not create stale booking.
- [ ] AVG-11 customer sends voice-like typo/slang Hebrew → handles robustly.

## Phase 4 — Modify/cancel reservation

- [ ] MOD-01 change time: `אפשר להזיז ל-21:00?` → updates if available.
- [ ] MOD-02 change party size up/down → recalculates availability/capacity.
- [ ] MOD-03 change date → updates reservation and confirms new date.
- [ ] MOD-04 cancel by same phone/name → cancels and confirms simply.
- [ ] MOD-05 cancel ambiguous guest → asks one short clarification.
- [ ] MOD-06 cancellation appears in dashboard.
- [ ] MOD-07 owner cancellation notification sent.
- [ ] MOD-08 no reversal of completed/cancelled/no_show without explicit safe support.

## Phase 5 — Waitlist

- [ ] WAI-01 no slot → customer accepts waitlist → waitlist entry created.
- [ ] WAI-02 customer declines waitlist → no entry created.
- [ ] WAI-03 waitlist requires date/time range/party size/name/phone.
- [ ] WAI-04 waitlist confirmation sounds positive, not consolation-prize.
- [ ] WAI-05 waitlist visible in dashboard.
- [ ] WAI-06 if slot opens, owner/customer flow is understandable.

## Phase 6 — Returning guest / CRM recognition

- [ ] CRM-01 same phone books again → guest is matched, not duplicated.
- [ ] CRM-02 returning guest greeted naturally by name.
- [ ] CRM-03 guest preferences/notes are respected if present.
- [ ] CRM-04 VIP/tagged guest gets warmer handling without exposing private tags awkwardly.
- [ ] CRM-05 no-show history is not mentioned to customer.

## Phase 7 — Dashboard and operations lifecycle

- [ ] OPS-01 owner/staff can confirm pending reservation.
- [ ] OPS-02 confirmed → seated.
- [ ] OPS-03 seated → completed.
- [ ] OPS-04 confirmed/seated → no_show increments no-show count once.
- [ ] OPS-05 cancelled reservations do not count as active occupancy.
- [ ] OPS-06 table-status reflects active reservations.
- [ ] OPS-07 completed reservation triggers loyalty side effects only once.

## Phase 8 — Membership club, after reservations pass

### Member basics

- [ ] MEM-01 `אני חבר מועדון?` → finds/creates/identifies membership cleanly.
- [ ] MEM-02 `כמה נקודות יש לי?` → returns balance in simple Hebrew.
- [ ] MEM-03 `איזה הטבות יש לי?` → offers 1-2 relevant active rewards, not a dump.
- [ ] MEM-04 guest with no points → positive explanation and how to earn.
- [ ] MEM-05 opted-out guest → no proactive marketing language.

### Rewards and redemption

- [ ] REW-01 claim active reward.
- [ ] REW-02 insufficient points → friendly alternative.
- [ ] REW-03 redeem claim from dashboard/staff flow.
- [ ] REW-04 already redeemed claim cannot be reused.
- [ ] REW-05 expired/cancelled claim handled cleanly.

### Retention moments

- [ ] RET-01 birthday/celebration booking gets table-treat language.
- [ ] RET-02 referral: `אני רוצה להביא חבר` → explains referral simply.
- [ ] RET-03 lapsed guest comeback → soft hospitality offer, not spammy.
- [ ] RET-04 host perk for 6+ guests → `יש צ׳ופר קטן למארח` style.
- [ ] RET-05 after completed visit, points/stamps update is correct.
- [ ] RET-06 proactive loyalty messages respect max 2/week unless transactional.

## Phase 9 — Failure handling

- [ ] ERR-01 API unavailable → customer gets graceful delay message, not error details.
- [ ] ERR-02 database conflict → no duplicate confirmation.
- [ ] ERR-03 Telegram send failure → logged for owner/internal retry.
- [ ] ERR-04 auth/token issue → internal fix, customer sees generic hold message.
- [ ] ERR-05 invalid restaurant resolution → blocks action rather than writing to BFF by accident.

## Test log template

```md
### TEST-ID — title
- Prompt:
- Expected reply:
- Actual reply:
- API/DB result:
- Dashboard result:
- Owner notification:
- Hebrew quality: pass/fail
- Status: pass/fail
- Notes / bug:
```
