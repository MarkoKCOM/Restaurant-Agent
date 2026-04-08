## Context

OpenSeat already models reservation statuses (`pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`) and sources (`web`, `whatsapp`, `telegram`, `phone`, `walk_in`), but the operational behavior is still shallow. The API mostly updates `status` as a plain field, the dashboard mixes generic editing with quick actions, and lifecycle events are not timestamped beyond `created_at` / `updated_at`.

For the pilot restaurant, the owner needs a clean service flow:
- confirm bookings when needed
- seat arriving guests
- complete tables after departure
- mark no-shows safely
- cancel when necessary
- register true walk-ins without pretending they came by phone

## Goals / Non-Goals

Goals
- Persist timestamps for meaningful lifecycle events
- Allow only legal status transitions in backend code
- Keep one reservation model for advance bookings and walk-ins
- Give owners explicit controls in Today and reservation detail views
- Make walk-ins visible as `source=walk_in` and optionally seat them immediately

Non-Goals
- Full audit log with actor identity for every field change
- Table transfer / split / merge workflows during service
- SMS / WhatsApp automation changes tied to each lifecycle event
- Removing the existing reservation edit flow for date/time/party size

## Decisions

### 1. Store one timestamp per lifecycle milestone on `reservations`
Decision: extend `reservations` with nullable `confirmed_at`, `seated_at`, `completed_at`, `cancelled_at`, and `no_show_at` columns.

Why:
- Owners need to know when service events actually happened
- Guest history, loyalty, and future analytics can reuse the same fields
- It is simpler and cheaper than introducing a separate lifecycle events table right now

Implementation notes:
- Creating a normal reservation starts as `confirmed` and sets `confirmed_at` on insert
- Creating a walk-in can start as `confirmed` or `seated`; if created as `seated`, both `confirmed_at` and `seated_at` are set on insert
- Transitioning into a status sets its timestamp if missing
- Moving away from a status does not erase prior timestamps

### 2. Centralize status rules in the reservation service
Decision: all lifecycle changes go through one transition validator in `reservation.service.ts`.

Why:
- The current API allows status writes that are too permissive
- Today view, detail panel, and future agent tools should share the same business rules
- Validation belongs in the backend, not just the dashboard

Allowed transitions:
- `pending -> confirmed | cancelled`
- `confirmed -> seated | cancelled | no_show`
- `seated -> completed`
- terminal states (`completed`, `cancelled`, `no_show`) cannot transition further through normal owner actions

Implementation notes:
- `PATCH /reservations/:id` can still edit date, time, party size, notes, and table IDs, but status changes must pass the transition validator
- `POST /reservations/:id/no-show` should call the same transition logic instead of bypassing it
- `DELETE /reservations/:id` becomes a lifecycle cancellation action that also sets `cancelled_at`
- Invalid transitions return `409` with a clear error message the dashboard can show directly

### 3. Add a dedicated owner walk-in flow
Decision: add an authenticated owner-focused walk-in path instead of overloading the public reservation create flow with arbitrary initial statuses.

Why:
- Public booking creation should stay simple and safe
- Walk-ins need owner-only behavior such as “seat immediately”
- This keeps web/widget/agent booking rules distinct from in-service operations

Implementation notes:
- Add `POST /api/v1/reservations/walk-in`
- Payload includes restaurant, guest info, party size, date/time, notes, and `seatImmediately`
- Source is always stored as `walk_in`
- Walk-ins still use normal availability/table assignment logic; if no table fits, the request fails and nothing is created
- When `seatImmediately=true`, the inserted reservation uses `status=seated` and stamps `confirmed_at` + `seated_at`

### 4. Replace free-form owner status editing with guided controls
Decision: the dashboard should present next-step actions and lifecycle context instead of a generic “pick any status” control.

Why:
- Operators think in actions (“Seat”, “Complete”, “Mark no-show”), not enum values
- Guided controls reduce mistakes and map cleanly to backend transition rules
- The reservation detail panel should mirror the Today view, not behave like a separate system

Implementation notes:
- Today view keeps compact action buttons based on the current status
- Reservation detail shows source badge, lifecycle timeline, and only the allowed next actions
- Date/time/party size/notes remain editable where valid
- Walk-ins are visually labeled so staff can distinguish them from pre-booked guests

## Risks / Trade-offs

- Existing records will have null lifecycle timestamps until touched by new logic
- Tightening transitions may expose dashboard flows that relied on permissive PATCH behavior
- A dedicated walk-in endpoint adds one more API surface, but it keeps public creation safer and clearer

## Migration Plan

1. Add OpenSpec change and capability specs
2. Extend reservation schema + domain types for lifecycle timestamps
3. Add DB migration
4. Refactor reservation service to use shared transition logic
5. Add owner walk-in endpoint and tests
6. Update dashboard Today / reservation detail / creation flows
7. Type-check and build affected packages
8. Smoke test normal reservation edits, lifecycle actions, and walk-in creation
