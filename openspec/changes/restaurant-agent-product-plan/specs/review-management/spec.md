## ADDED Requirements

### Requirement: Review prompt routing
The system SHALL only prompt guests for public reviews when sentiment is positive. Negative sentiment SHALL be routed privately to the owner for service recovery.

#### Scenario: Happy guest gets review prompt
- **WHEN** a guest responds positively to a "How was your visit?" message (e.g., "Amazing, loved it!")
- **THEN** the system SHALL send a Google Review link with a pre-filled star suggestion

#### Scenario: Unhappy guest routed to owner
- **WHEN** a guest responds negatively (e.g., "Service was terrible")
- **THEN** the system SHALL apologize, ask for details, and forward the thread to the owner with a recommended recovery action

### Requirement: Google Reviews integration
The system SHALL generate a direct Google Review link for the restaurant. The system SHALL track how many reviews were generated through the platform.

#### Scenario: Track review attribution
- **WHEN** a guest clicks the Google Review link sent by the system
- **THEN** the system SHALL log the click and attribute the review to the engagement flow

### Requirement: Sentiment tracking
The system SHALL track overall guest sentiment from engagement responses and display a sentiment score trend on the analytics dashboard.

#### Scenario: Owner views sentiment trend
- **WHEN** the owner checks the analytics dashboard
- **THEN** the system SHALL display a weekly sentiment trend based on guest response analysis

### Requirement: Service recovery workflow
The system SHALL suggest service recovery actions for negative feedback: send apology, offer discount on next visit, schedule a call from the owner, or escalate to manager.

#### Scenario: Owner resolves complaint with voucher
- **WHEN** the owner receives a complaint alert and chooses "Send 20% discount voucher"
- **THEN** the system SHALL send the guest a personalized apology with the voucher code
