## ADDED Requirements

### Requirement: Today view service actions
The system SHALL provide owner-facing service controls in the Today view that match the legal reservation lifecycle.

#### Scenario: Next-step actions match current status
- **WHEN** the Today view renders a reservation row
- **THEN** the row SHALL show only the valid next actions for that reservation status
- **AND** those actions SHALL map to the same backend transition rules used elsewhere

#### Scenario: Walk-in is visible in service list
- **WHEN** a reservation source is `walk_in`
- **THEN** the Today view SHALL label it distinctly from advance bookings
- **AND** staff SHALL be able to manage it with the same lifecycle actions as other reservations

#### Scenario: Lifecycle updates refresh operational context
- **WHEN** an owner performs a service action from the Today view
- **THEN** the reservation list SHALL refresh to show the new status and lifecycle metadata without a full page reload

### Requirement: Walk-in registration from service flow
The system SHALL let owners create walk-ins directly from the daily operations workflow.

#### Scenario: Owner adds a walk-in from Today view
- **WHEN** the owner opens the walk-in form from the Today view
- **THEN** the form SHALL collect guest name, phone, party size, arrival time, and optional notes
- **AND** it SHALL submit the reservation as source `walk_in`

#### Scenario: Owner seats a walk-in immediately
- **WHEN** the owner enables immediate seating in the walk-in form
- **THEN** the newly created reservation SHALL appear in Today view as `seated`
- **AND** the UI SHALL reflect that it is already in service

#### Scenario: Walk-in creation fails due to capacity
- **WHEN** the backend rejects a walk-in because there is no suitable table available
- **THEN** the Today view SHALL keep the modal open
- **AND** it SHALL show the returned capacity error so the owner can adjust the request

## Acceptance Criteria

- AC-1: Today view action buttons are derived from allowed lifecycle transitions
- AC-2: Walk-ins are visually labeled in the service list
- AC-3: Today view can create walk-ins without navigating away
- AC-4: Immediate-seating walk-ins render as `seated` after creation
- AC-5: Failed walk-in creation shows a clear inline error and does not create a ghost row

## Dependencies

- Depends on `reservation-engine` for owner walk-in creation and lifecycle validation
