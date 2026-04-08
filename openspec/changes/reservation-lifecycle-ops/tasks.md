## Reservation Lifecycle Ops Tasks

### Spec / Planning
- [x] Add proposal for lifecycle timestamps, safe status transitions, and walk-in flow
- [x] Add design doc for backend lifecycle rules and owner-facing controls
- [x] Add capability specs for reservation engine, reservation detail, and service-floor operations

### Backend
- [x] Extend `reservations` schema with lifecycle timestamp columns
- [x] Update shared domain `Reservation` types / schemas with lifecycle metadata used by API and dashboard
- [x] Generate and review the Drizzle migration
- [x] Centralize legal reservation status transitions in `apps/api/src/services/reservation.service.ts`
- [x] Route PATCH / no-show / cancel flows through the shared transition logic
- [x] Add authenticated `POST /api/v1/reservations/walk-in`
- [x] Add or update backend tests for transitions, timestamps, and walk-in creation

### Frontend
- [x] Update dashboard API hooks/types for lifecycle metadata and walk-in creation
- [x] Replace free-form owner status selection in reservation detail with guided lifecycle actions
- [x] Show reservation source + lifecycle timestamps in reservation detail
- [x] Add Today view owner controls that respect backend transition rules
- [x] Add walk-in creation UI from the service workflow
- [x] Label walk-ins distinctly in daily operations views

### Verification
- [x] `pnpm --filter @openseat/domain build`
- [x] `pnpm --filter @openseat/api type-check`
- [x] `pnpm --filter @openseat/dashboard type-check`
- [x] `pnpm --filter @openseat/api build`
- [x] `pnpm --filter @openseat/dashboard build`
- [x] Smoke test: confirm -> seat -> complete flow
- [x] Smoke test: confirmed -> no-show flow
- [x] Smoke test: walk-in create with and without immediate seating
