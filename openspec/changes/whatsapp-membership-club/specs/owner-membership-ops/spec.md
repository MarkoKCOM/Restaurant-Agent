## ADDED Requirements

### Requirement: Owner/admin membership operations
Restaurant admins SHALL be able to configure and operate the membership club from the dashboard.

#### Scenario: Owner manages rewards
- WHEN an owner/admin opens membership settings or reward management
- THEN they SHALL be able to create, update, activate, and deactivate rewards for their restaurant

#### Scenario: Owner reviews member activity
- WHEN an owner/admin inspects guest activity
- THEN they SHALL be able to see membership-relevant events such as points earned, rewards claimed, tier changes, and retention triggers

#### Scenario: Owner configures club messaging/perks
- WHEN an owner/admin configures the restaurant's membership club
- THEN they SHALL be able to define club framing such as welcome copy, perk descriptions, and campaign-style member incentives

### Requirement: Staff redemption workflow
Operational staff SHALL be able to honor and complete member reward claims without gaining owner-level control.

#### Scenario: Staff verifies member reward
- WHEN a guest presents a reward code or says they claimed a benefit in WhatsApp
- THEN staff SHALL be able to verify whether the reward is valid and pending
- AND mark it redeemed once honored

#### Scenario: Employee permissions
- WHEN an employee accesses the dashboard
- THEN they SHALL be able to see operational member signals needed for service
- BUT SHALL NOT be able to edit reward strategy, club settings, or owner-level membership configuration

### Requirement: Reservation and guest views show member signals
Membership state SHALL be surfaced where it affects service.

#### Scenario: VIP reservation
- WHEN a high-tier or reward-carrying guest has a reservation
- THEN reservation and guest views SHALL expose the relevant VIP/reward signal to staff before service
