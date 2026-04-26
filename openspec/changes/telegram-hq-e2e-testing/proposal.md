# Telegram HQ E2E Testing

## Why

Until WhatsApp access is live, Telegram is the fastest safe channel for customer-flow testing. We need a clean tenant that does not pollute BFF pilot data and a repeatable checklist that tests the two things that matter first:

1. how Jake speaks with customers in natural Hebrew
2. whether reservations actually work end to end across agent, API, dashboard, and owner notifications

Membership club flows come next, after the reservation loop is stable.

## What changes

- Use `OpenSeat HQ` as the clean internal sandbox tenant for Telegram customer testing.
- Keep BFF Ra'anana as the live pilot baseline unless explicitly wiped.
- Run Telegram General topic tests as the WhatsApp substitute.
- Track every test as a customer conversation + system result, not just an API call.
- Prioritize Hebrew-first customer experience before dashboard polish.

## Current sandbox state

- `BFF Ra'anana` slug: `bff-raanana`
- `BFF Ra'anana` id: `c3c22e37-a309-4fde-aa6c-6e714212a3bc`
- `OpenSeat HQ` slug: `openseat-hq`
- `OpenSeat HQ` id: `2ff77e70-f540-41cc-a388-9254255a9ee6`
- `OpenSeat HQ` starts with 15 cloned tables and zero operational data.

## BFF wipe policy

BFF currently has operational/test data attached to the pilot tenant. Wiping it is destructive.

Before deletion, require explicit confirmation of scope:

- Safe reset: guests, reservations, waitlist, conversations, loyalty transactions, reward claims, campaigns, engagement jobs, challenges, challenge progress, visit logs
- Preserve setup: restaurant row, tables, admin users, operating hours, dashboard/widget config, agent config
- Optional preserve: active reward templates if we want them available for membership testing

## Success criteria

- Hebrew customer replies feel like a real Israeli host, not a translated bot.
- Reservation requests create/update/cancel real records under the right tenant.
- Dashboard reflects customer actions immediately.
- Owner notifications are short and actionable.
- Edge cases fail gracefully with a useful next step.
- Membership testing starts only after core booking flows pass.
