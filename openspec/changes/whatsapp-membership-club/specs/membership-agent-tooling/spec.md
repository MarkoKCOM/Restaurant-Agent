## ADDED Requirements

### Requirement: Explicit membership tools for the agent
The system SHALL provide explicit API/tool support for membership operations used in WhatsApp conversations.

#### Scenario: Agent answers membership question reliably
- WHEN the guest asks a membership-related question in WhatsApp
- THEN the agent SHALL be able to retrieve a normalized membership summary without reconstructing it manually from multiple raw endpoints

#### Scenario: Agent creates reward claim
- WHEN the guest chooses to redeem a reward in WhatsApp
- THEN the agent SHALL be able to call a dedicated reward-claim flow that returns a guest-safe claim result and operational metadata for staff

### Requirement: Membership lifecycle hooks are wired to visit completion
Membership updates SHALL be consistently triggered by reservation lifecycle events.

#### Scenario: Visit completion updates all member systems
- WHEN a reservation transitions into completed
- THEN the system SHALL update the guest's visit count, points, tier, stamp progress, applicable streaks, and applicable challenge progress
- AND enqueue any relevant member automation in a deterministic order

#### Scenario: Partial failure handling
- WHEN one post-visit membership step fails
- THEN the system SHALL record the failure and expose retry/repair visibility
- AND the platform SHALL avoid silent drift between points, rewards, streaks, and messaging state

### Requirement: WhatsApp readiness for membership flows
Membership tooling SHALL be designed for WhatsApp execution constraints.

#### Scenario: Guest asks in natural language with incomplete context
- WHEN the guest asks a membership question without precise technical terms
- THEN the agent SHALL still be able to map the request into the proper membership tool/action
- AND respond with concise, guest-friendly copy suitable for WhatsApp

#### Scenario: Essential reservation vs promotional messaging separation
- WHEN the agent or automation is about to send a club-related message
- THEN the system SHALL distinguish between transactional reservation communication and optional membership/promotional messaging preferences
