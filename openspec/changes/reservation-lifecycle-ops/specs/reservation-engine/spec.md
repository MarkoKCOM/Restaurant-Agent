## MODIFIED Requirements

### Requirement: Reservation lifecycle state management
The system SHALL enforce legal reservation lifecycle transitions in backend code and persist lifecycle timestamps for operational statuses.

#### Scenario: Reservation is confirmed on creation
- **WHEN** a standard reservation is successfully created through the booking flow
- **THEN** the system SHALL store the reservation with status `confirmed`
- **AND** the system SHALL set `confirmed_at`

#### Scenario: Owner seats a confirmed reservation
- **GIVEN** a reservation is in status `confirmed`
- **WHEN** an owner marks the reservation as seated
- **THEN** the system SHALL update the status to `seated`
- **AND** the system SHALL set `seated_at`
- **AND** the system SHALL preserve any previously recorded lifecycle timestamps

#### Scenario: Owner completes a seated reservation
- **GIVEN** a reservation is in status `seated`
- **WHEN** an owner marks the reservation as completed
- **THEN** the system SHALL update the status to `completed`
- **AND** the system SHALL set `completed_at`

#### Scenario: Owner marks a confirmed reservation as no-show
- **GIVEN** a reservation is in status `confirmed`
- **WHEN** an owner marks the reservation as no-show
- **THEN** the system SHALL update the status to `no_show`
- **AND** the system SHALL set `no_show_at`
- **AND** the system SHALL increment the guest no-show count

#### Scenario: Owner cancels a pending or confirmed reservation
- **GIVEN** a reservation is in status `pending` or `confirmed`
- **WHEN** an owner cancels the reservation
- **THEN** the system SHALL update the status to `cancelled`
- **AND** the system SHALL set `cancelled_at`
- **AND** any freed inventory SHALL become available immediately

#### Scenario: Illegal status transition is rejected
- **GIVEN** a reservation is in status `pending`
- **WHEN** a client attempts to move it directly to `completed`
- **THEN** the system SHALL reject the request with a conflict response
- **AND** the reservation SHALL remain unchanged

### Requirement: Owner walk-in creation
The system SHALL allow authenticated staff to create walk-ins as reservation records that participate in the same lifecycle model as advance bookings.

#### Scenario: Create walk-in and seat immediately
- **WHEN** an owner creates a walk-in with `seatImmediately=true`
- **THEN** the system SHALL create the reservation with source `walk_in`
- **AND** the system SHALL assign a table using normal availability rules
- **AND** the reservation SHALL start in status `seated`
- **AND** the system SHALL set both `confirmed_at` and `seated_at`

#### Scenario: Create walk-in without immediate seating
- **WHEN** an owner creates a walk-in with `seatImmediately=false`
- **THEN** the system SHALL create the reservation with source `walk_in`
- **AND** the reservation SHALL start in status `confirmed`
- **AND** the system SHALL set `confirmed_at`

#### Scenario: Walk-in cannot be seated without capacity
- **WHEN** an owner attempts to create a walk-in for a party size with no suitable available table
- **THEN** the system SHALL reject the request with a clear availability error
- **AND** no reservation SHALL be created

## Acceptance Criteria

- AC-1: Reservation responses include lifecycle timestamps when present
- AC-2: `confirmed_at` is set for newly created standard reservations
- AC-3: Transitioning from `confirmed` to `seated` sets `seated_at` once
- AC-4: Transitioning from `seated` to `completed` sets `completed_at`
- AC-5: Transitioning from `confirmed` to `no_show` sets `no_show_at` and increments guest no-show count
- AC-6: Cancelling a pending/confirmed reservation sets `cancelled_at`
- AC-7: Invalid transitions return a 409-class error and do not modify the reservation
- AC-8: `POST /api/v1/reservations/walk-in` creates `source=walk_in` reservations only for authenticated owner flows
- AC-9: Walk-ins use the same table assignment / availability checks as standard reservations

## Dependencies

- Depends on DB migration for lifecycle timestamp columns
- Powers `reservation-detail` and `service-floor-ops`
