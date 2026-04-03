## ADDED Requirements

### Requirement: Create reservation
The system SHALL allow guests to create a reservation by providing date, time, party size, and contact info. The system SHALL validate against restaurant capacity, operating hours, and existing bookings before confirming.

#### Scenario: Successful reservation within capacity
- **WHEN** a guest requests a reservation for 4 people on Friday at 20:00 and the restaurant has available tables
- **THEN** the system SHALL create the reservation, assign a table, and return a confirmation with reservation ID

#### Scenario: Reservation exceeds capacity
- **WHEN** a guest requests a reservation but all suitable tables are occupied at the requested time
- **THEN** the system SHALL reject the reservation and suggest the 3 nearest available time slots

#### Scenario: Reservation outside operating hours
- **WHEN** a guest requests a reservation outside the restaurant's configured operating hours
- **THEN** the system SHALL reject with a message showing the restaurant's hours

### Requirement: Modify reservation
The system SHALL allow guests to modify an existing reservation's date, time, or party size. Changes SHALL be validated against current availability.

#### Scenario: Successful modification
- **WHEN** a guest requests to change their reservation from 20:00 to 21:00 and a table is available
- **THEN** the system SHALL update the reservation and send a confirmation with the new details

#### Scenario: Modification to unavailable slot
- **WHEN** a guest requests to change to a time that has no availability
- **THEN** the system SHALL keep the original reservation unchanged and suggest alternatives

### Requirement: Cancel reservation
The system SHALL allow guests to cancel a reservation. Cancelled slots SHALL immediately become available for new bookings.

#### Scenario: Guest cancels reservation
- **WHEN** a guest requests to cancel their reservation
- **THEN** the system SHALL mark it as cancelled, free the table, and send a cancellation confirmation

### Requirement: Table management
The system SHALL maintain a table map with table IDs, seat capacity (min/max), and combinability rules. Maximum total capacity SHALL be configurable up to 80 seats (Starter) or unlimited (Growth).

#### Scenario: Auto-assign table by party size
- **WHEN** a reservation is created for a party of 3
- **THEN** the system SHALL assign the smallest available table that fits 3 or more guests

#### Scenario: Combine tables for large party
- **WHEN** a reservation is created for a party of 8 and no single table fits 8 but two adjacent 4-tops are combinable
- **THEN** the system SHALL combine the tables and assign both to the reservation

### Requirement: Waitlist management
The system SHALL maintain a waitlist when the restaurant is fully booked. Guests on the waitlist SHALL be automatically notified when a matching slot opens.

#### Scenario: Add to waitlist
- **WHEN** a guest requests a reservation at a fully booked time
- **THEN** the system SHALL offer to add them to the waitlist with their preferred time window and party size

#### Scenario: Slot opens from cancellation
- **WHEN** a reservation is cancelled and a waitlisted guest matches the freed slot
- **THEN** the system SHALL notify the waitlisted guest via WhatsApp and hold the slot for 15 minutes

### Requirement: No-show tracking
The system SHALL track no-shows per guest. After a guest accumulates 3 no-shows, the system SHALL flag them and alert the owner.

#### Scenario: Mark reservation as no-show
- **WHEN** a reserved guest does not arrive within 15 minutes of their reservation time and staff marks them as no-show
- **THEN** the system SHALL record the no-show, increment the guest's no-show count, and free the table

#### Scenario: Repeat no-show alert
- **WHEN** a guest with 3+ previous no-shows makes a new reservation
- **THEN** the system SHALL alert the owner/manager and suggest requiring confirmation or deposit

### Requirement: Daily capacity view
The system SHALL provide a real-time view of the day's reservations, available slots, and occupancy percentage.

#### Scenario: Owner checks today's bookings
- **WHEN** the owner requests today's summary
- **THEN** the system SHALL return total reservations, covers, occupancy by time slot, and any waitlisted guests

### Requirement: Operating hours and special dates
The system SHALL support configurable operating hours per day of week, plus special dates (holidays, private events, closures).

#### Scenario: Restaurant closed for holiday
- **WHEN** the owner marks April 15 as closed for Passover
- **THEN** the system SHALL reject all reservation requests for that date with a custom message
