## Why

Reservation operations are currently split across a few loose mutations: the dashboard can PATCH any status directly, no-show is a separate endpoint, cancellation is a DELETE, and none of those lifecycle changes record when the event actually happened. That makes it hard for owners to trust the operational history of a reservation, and it creates room for invalid flows like skipping from `pending` to `completed` with no audit trail.

There is also no real walk-in flow. Staff can create a reservation from the dashboard, but it is treated like a phone booking and does not capture that the guest arrived on-site. For BFF and future restaurants, walk-ins are part of daily service, so they need to live inside the same reservation lifecycle as advance bookings.

## What Changes

- Add lifecycle timestamps to reservation records for key operational state changes
- Enforce safe reservation status transitions in the backend instead of trusting arbitrary PATCH payloads
- Add owner-facing status controls that reflect the allowed lifecycle transitions
- Add a dedicated walk-in creation flow for staff during service
- Surface lifecycle history and source context in reservation detail and daily operations views

## Capabilities

### New Capabilities
- `service-floor-ops`: Owners can register walk-ins, progress reservations through service, and see operational lifecycle context from the Today view

### Modified Capabilities
- `reservation-engine`: Reservation writes now track lifecycle timestamps, validate legal status transitions, and support owner-created walk-ins
- `reservation-detail`: Reservation detail shows lifecycle metadata and exposes safe owner controls instead of a free-form status edit

## Impact

- Database migration on `reservations`
- Domain types and schemas gain lifecycle metadata
- Reservation service centralizes status-transition rules
- Reservation API adds owner-safe lifecycle and walk-in handling
- Dashboard Today / Reservations flows are updated for service operations
