## ADDED Requirements

### Requirement: Membership club as a product layer
The system SHALL expose loyalty and retention features as a coherent restaurant membership club, not only as isolated backend counters.

#### Scenario: Guest becomes club member after early interaction
- WHEN a guest completes their first qualifying interaction for a Growth-enabled restaurant
- THEN the system SHALL treat them as an active club member for that restaurant
- AND their member state SHALL be available to WhatsApp flows and owner/staff operational views

#### Scenario: Owner explains the product to guests
- WHEN a restaurant promotes its club to guests
- THEN the platform SHALL support a clear framing of benefits such as points, rewards, status, and member-only perks
- AND the experience SHALL not require the guest to install a separate app

### Requirement: Membership profile summary
The system SHALL support a single membership summary for a guest at a restaurant.

#### Scenario: Guest asks for club status
- WHEN a guest asks for their membership status
- THEN the system SHALL provide a summary including at minimum current points, tier, stamp progress, and next milestone

#### Scenario: Staff opens a member reservation
- WHEN staff views a reservation or guest profile for a member
- THEN the system SHALL show the guest's relevant club status and any active reward or VIP signal needed for service

### Requirement: Growth-package gating
Restaurant membership club features SHALL be packaged as a Growth capability.

#### Scenario: Starter restaurant access
- WHEN a Starter-package restaurant accesses Growth-only membership capabilities
- THEN the system SHALL block those capabilities or present upgrade messaging
- AND reservation operations SHALL continue to work normally
