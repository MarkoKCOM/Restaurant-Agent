# Waitlist Engine

## Overview

Implement a waitlist system that allows guests to join a queue when no tables are available for their desired time. When a reservation is cancelled, the system automatically finds matching waitlist entries and offers the freed slot. Offered entries expire after 15 minutes if not accepted. Expiry is checked lazily on each relevant API call rather than via a background cron job.

## Requirements

- REQ-1: Create a `waitlist` table with columns: `id`, `restaurantId`, `guestName`, `guestPhone`, `date`, `preferredTimeStart`, `preferredTimeEnd`, `partySize`, `status` (enum: `waiting`, `offered`, `accepted`, `expired`, `cancelled`), `expiresAt` (nullable timestamp), `createdAt`.
- REQ-2: `POST /api/v1/waitlist` creates a new entry with status `waiting`. Required fields: `restaurantId`, `guestName`, `guestPhone`, `date`, `preferredTimeStart`, `preferredTimeEnd`, `partySize`.
- REQ-3: `GET /api/v1/waitlist?restaurantId=X&date=Y` returns all entries with status `waiting` or `offered` for the given restaurant and date, ordered by `createdAt` ascending.
- REQ-4: When a reservation is cancelled (via `DELETE /api/v1/reservations/:id`), the system queries the waitlist for entries matching: same `restaurantId`, same `date`, `partySize` fits freed table(s), and `preferredTimeStart <= freedTime <= preferredTimeEnd`. The earliest matching entry (by `createdAt`) is set to `status='offered'` with `expiresAt = now() + 15 minutes`.
- REQ-5: `POST /api/v1/waitlist/:id/accept` converts an offered entry into a confirmed reservation. Fails with 409 if the entry is not in `offered` status or has expired.
- REQ-6: On every `GET /api/v1/waitlist` and `POST /api/v1/waitlist/:id/accept` call, run a lazy expiry check: update all entries where `status='offered'` and `expiresAt < now()` to `status='expired'`.
- REQ-7: `POST /api/v1/waitlist/:id/cancel` sets status to `cancelled`.
- REQ-8: Validate phone number format (Israeli: 05X-XXXXXXX or +972-5X-XXXXXXX).

## Acceptance Criteria

- AC-1: `POST /api/v1/waitlist` with valid data returns 201 and the created entry with status `waiting`.
- AC-2: `POST /api/v1/waitlist` with missing required fields returns 400.
- AC-3: `GET /api/v1/waitlist?restaurantId=X&date=Y` returns only `waiting` and `offered` entries for that restaurant and date.
- AC-4: Cancelling a reservation triggers auto-match: a matching waitlist entry transitions to `offered` with an `expiresAt` 15 minutes in the future.
- AC-5: `POST /api/v1/waitlist/:id/accept` on an offered (non-expired) entry creates a reservation and returns 200 with the new reservation.
- AC-6: `POST /api/v1/waitlist/:id/accept` on an expired entry returns 409.
- AC-7: Calling `GET /api/v1/waitlist` after 15 minutes have passed since an offer causes the offered entry to appear as expired (lazy expiry).
- AC-8: If multiple waitlist entries match a cancellation, only the oldest (earliest `createdAt`) is offered.
- AC-9: `POST /api/v1/waitlist/:id/cancel` sets the entry to `cancelled` and it no longer appears in GET results.

## API Changes

| Method | Path | Auth | Request Body / Params | Response |
|--------|------|------|-----------------------|----------|
| POST | `/api/v1/waitlist` | Required | `{ restaurantId, guestName, guestPhone, date, preferredTimeStart, preferredTimeEnd, partySize }` | `201 { id, status, ... }` |
| GET | `/api/v1/waitlist` | Required | Query: `restaurantId`, `date` | `200 [ { id, guestName, guestPhone, date, preferredTimeStart, preferredTimeEnd, partySize, status, expiresAt, createdAt } ]` |
| POST | `/api/v1/waitlist/:id/accept` | Required | None | `200 { reservation: {...}, waitlistEntry: {...} }` |
| POST | `/api/v1/waitlist/:id/cancel` | Required | None | `200 { id, status: 'cancelled' }` |

Side effect on `DELETE /api/v1/reservations/:id`: triggers waitlist auto-match logic.

## Database Changes

New `waitlist` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| restaurantId | uuid | FK to restaurants, not null |
| guestName | varchar(255) | not null |
| guestPhone | varchar(20) | not null |
| date | date | not null |
| preferredTimeStart | time | not null |
| preferredTimeEnd | time | not null |
| partySize | integer | not null |
| status | varchar(20) | default 'waiting' |
| expiresAt | timestamp | nullable |
| createdAt | timestamp | default now() |

Index on `(restaurantId, date, status)` for efficient querying.
