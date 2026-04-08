## MODIFIED Requirements

### Requirement: Reservation detail shows lifecycle context
The reservation detail experience SHALL show source and lifecycle metadata so operators can understand how a reservation progressed.

#### Scenario: Owner opens a web booking
- **WHEN** an owner opens a reservation created from the website
- **THEN** the detail panel SHALL show the booking source as `web`
- **AND** it SHALL display any available lifecycle timestamps such as confirmed, seated, completed, cancelled, or no-show

#### Scenario: Owner opens a walk-in
- **WHEN** an owner opens a walk-in reservation
- **THEN** the detail panel SHALL visually identify it as a walk-in
- **AND** it SHALL show the same editable operational fields as other reservations

### Requirement: Reservation detail uses guided lifecycle actions
The reservation detail panel SHALL expose only the lifecycle actions that are valid for the reservation’s current state.

#### Scenario: Confirmed reservation can be seated
- **GIVEN** a reservation is `confirmed`
- **WHEN** the owner opens the detail panel
- **THEN** the panel SHALL offer actions for `Seat`, `Cancel`, and `Mark no-show`
- **AND** it SHALL NOT offer `Complete`

#### Scenario: Seated reservation can be completed only
- **GIVEN** a reservation is `seated`
- **WHEN** the owner opens the detail panel
- **THEN** the panel SHALL offer `Complete`
- **AND** it SHALL NOT offer `Cancel` or `Mark no-show`

#### Scenario: Terminal reservation is read-only for lifecycle actions
- **GIVEN** a reservation is `completed`, `cancelled`, or `no_show`
- **WHEN** the owner opens the detail panel
- **THEN** the panel SHALL show the recorded lifecycle status and timestamps
- **AND** it SHALL disable further lifecycle actions

#### Scenario: Backend transition error is surfaced
- **WHEN** the owner triggers a lifecycle action and the backend rejects it
- **THEN** the detail panel SHALL keep the current reservation state visible
- **AND** it SHALL show the returned error message without silently changing the UI

## Acceptance Criteria

- AC-1: Reservation detail displays a source badge or label for every reservation
- AC-2: Reservation detail displays lifecycle timestamps when present and hides empty milestones cleanly
- AC-3: The status control is action-based rather than an unrestricted enum dropdown for owner lifecycle operations
- AC-4: Date/time/party-size/notes edits still remain available where supported
- AC-5: Terminal reservations do not show invalid next-step actions
- AC-6: A rejected backend transition leaves the panel in sync with persisted data

## Dependencies

- Depends on `reservation-engine` lifecycle metadata and transition validation
