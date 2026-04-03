## ADDED Requirements

### Requirement: Digital stamp card
The system SHALL provide a digital stamp card where guests earn stamps per visit. The stamp threshold and reward SHALL be configurable per restaurant (default: 10 stamps = free dessert/drink).

#### Scenario: Guest earns stamp after visit
- **WHEN** a guest completes a visit and their reservation is marked as completed
- **THEN** the system SHALL add a stamp to their card and send a WhatsApp message showing their progress (e.g., "6/10 stamps — 4 more to your free dessert! 🎯")

#### Scenario: Guest redeems full stamp card
- **WHEN** a guest reaches 10 stamps
- **THEN** the system SHALL notify them of their reward, generate a redemption code, and notify staff to honor it on the next visit

### Requirement: Points system
The system SHALL award points based on configurable rules: per visit, per guest in party, per estimated spend, referral bonus, or special event bonus.

#### Scenario: Points awarded for visit with party of 4
- **WHEN** a guest completes a visit with a party of 4 and the restaurant awards 10 points per guest
- **THEN** the system SHALL award 40 points to the guest's account

#### Scenario: Guest checks points balance
- **WHEN** a guest sends "how many points do I have?" via WhatsApp
- **THEN** the system SHALL reply with their current balance, tier status, and nearest reward

### Requirement: Reward catalog
The system SHALL support a configurable reward catalog where points can be redeemed. Rewards SHALL be defined by the restaurant owner (e.g., 100 points = free appetizer, 500 points = bottle of wine).

#### Scenario: Owner configures rewards
- **WHEN** the owner adds a reward "Free Hummus — 80 points"
- **THEN** the system SHALL make it available for guest redemption

#### Scenario: Guest redeems reward
- **WHEN** a guest requests to redeem 80 points for Free Hummus
- **THEN** the system SHALL deduct the points, generate a redemption code, and notify staff

### Requirement: VIP tiers
The system SHALL support tiered membership: Bronze (default), Silver (after N visits or M points), Gold (after X visits or Y points). Thresholds SHALL be configurable. Each tier SHALL unlock perks defined by the owner.

#### Scenario: Guest promoted to Silver
- **WHEN** a guest reaches 10 visits (or the configured Silver threshold)
- **THEN** the system SHALL upgrade them to Silver tier, send a congratulations message, and list their new perks

#### Scenario: Tier perks on reservation
- **WHEN** a Gold-tier guest makes a reservation
- **THEN** the system SHALL flag the reservation as VIP to staff and auto-apply any Gold perks (e.g., priority seating, complimentary welcome drink)
