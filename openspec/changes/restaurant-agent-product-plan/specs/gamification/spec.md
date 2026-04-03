## ADDED Requirements

### Requirement: Visit streaks
The system SHALL track visit streaks — consecutive weeks/months with at least one visit. Streaks SHALL earn bonus points and special recognition.

#### Scenario: Guest maintains 4-week streak
- **WHEN** a guest visits for the 4th consecutive week
- **THEN** the system SHALL award a streak bonus (configurable, default: 2x points for that visit) and send a celebratory WhatsApp message

#### Scenario: Streak broken
- **WHEN** a guest misses a week after a 3-week streak
- **THEN** the system SHALL reset the streak counter and send a friendly "we miss you" message with an incentive to restart

### Requirement: Referral rewards
The system SHALL support a referral program where existing guests can invite friends. Both the referrer and the referred guest SHALL earn rewards when the referred guest completes their first visit.

#### Scenario: Guest refers a friend
- **WHEN** a guest requests a referral link via WhatsApp
- **THEN** the system SHALL generate a unique referral link/code and explain the reward for both parties

#### Scenario: Referred friend completes first visit
- **WHEN** a new guest makes and completes a reservation using a referral code
- **THEN** the system SHALL award bonus points to both the referrer and the new guest, and notify the referrer

### Requirement: Challenges and achievements
The system SHALL support time-limited challenges (e.g., "Visit 3 times in January and earn 200 bonus points") and permanent achievements (e.g., "First visit", "10th visit", "Tried the tasting menu").

#### Scenario: Owner creates a monthly challenge
- **WHEN** the owner creates a challenge "Visit 3 times in April — earn 200 bonus points"
- **THEN** the system SHALL announce it to eligible guests and track progress per guest

#### Scenario: Guest completes challenge
- **WHEN** a guest makes their 3rd visit within the challenge period
- **THEN** the system SHALL award the bonus, mark the challenge as completed, and send a congratulations message

### Requirement: Social sharing prompts
The system SHALL prompt guests to share achievements, tier promotions, and completed challenges on social media (Instagram story, WhatsApp status) with a branded template.

#### Scenario: Guest promoted to Gold tier
- **WHEN** a guest reaches Gold tier
- **THEN** the system SHALL offer a shareable branded image/story template celebrating their VIP status
