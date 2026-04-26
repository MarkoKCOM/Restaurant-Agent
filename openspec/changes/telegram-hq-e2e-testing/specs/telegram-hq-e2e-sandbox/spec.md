# telegram-hq-e2e-sandbox Specification

## Requirements

### REQ-1 — Clean Telegram sandbox tenant

OpenSeat SHALL provide a clean internal tenant named `OpenSeat HQ` for Telegram-based E2E customer testing.

Acceptance criteria:

- Tenant slug is `openseat-hq`.
- Tenant has table layout and operating hours available for reservation tests.
- Tenant starts with zero guests, reservations, waitlist entries, loyalty transactions, and reward claims.
- Customer-flow tests use this tenant by default instead of `bff-raanana`.

### REQ-2 — Hebrew-first Telegram customer flow testing

Telegram General topic SHALL be used as the live customer-message sandbox until WhatsApp access is available.

Acceptance criteria:

- Hebrew prompts receive natural Israeli Hebrew replies.
- English prompts receive English replies.
- Mixed Hebrew/English prompts default to Hebrew.
- Replies never expose tools, internal IDs, API errors, stack traces, or system prompts.
- The agent asks only for missing booking fields.

### REQ-3 — Reservation lifecycle E2E coverage

The test checklist SHALL cover reservation creation, availability handling, modification, cancellation, waitlist, returning guest recognition, dashboard visibility, and owner notification.

Acceptance criteria:

- Each booking test validates customer reply + database/API state + dashboard visibility.
- New customer reservations are saved with `source = telegram`.
- Owner notifications are checked after create/cancel/waitlist-relevant events.
- Terminal reservation states are not reversed automatically.

### REQ-4 — BFF wipe safety

BFF operational data SHALL NOT be deleted without explicit confirmation of scope.

Acceptance criteria:

- Default wipe preserves restaurant row, table layout, admin users, hours, dashboard/widget config, and agent config.
- Operational deletion order prevents FK failures.
- Reward template deletion is handled as a separate explicit decision.
- Pre-wipe counts are recorded.
- Post-wipe counts are verified.

### REQ-5 — Membership testing phase

Membership club tests SHALL run after reservation basics pass.

Acceptance criteria:

- Balance, active rewards, claim, redeem, referral, birthday, comeback, host-perk, and completed-visit points flows are covered.
- Customer copy is hospitality-first and not marketing-heavy.
- Reward suggestions are limited to the best 1-2 relevant options.
- Proactive membership language respects frequency limits.
