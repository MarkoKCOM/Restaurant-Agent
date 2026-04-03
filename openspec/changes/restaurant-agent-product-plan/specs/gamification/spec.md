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

### Requirement: Lucky spin / surprise rewards
The system SHALL support a configurable "lucky spin" mechanic — after every Nth visit (configurable, default: every 5th), the guest gets a random reward from a prize pool defined by the owner. Creates excitement and unpredictability.

#### Scenario: Guest triggers lucky spin on 5th visit
- **WHEN** a guest completes their 5th visit (or 10th, 15th, etc.)
- **THEN** the system SHALL randomly select a reward from the prize pool and send a WhatsApp message: "You won a surprise! 🎰 [reward name] — show this to your server next time"

#### Scenario: Owner configures prize pool
- **WHEN** the owner defines prizes: "Free dessert (40%), Free drink (30%), 20% off next visit (20%), Free meal for 2 (10%)"
- **THEN** the system SHALL weight random selection according to the configured probabilities

### Requirement: Group dining rewards
The system SHALL award bonus points or rewards when a guest brings a large party (configurable threshold, default: 6+). Incentivizes group bookings which are higher revenue.

#### Scenario: Guest books party of 8
- **WHEN** a guest makes and completes a reservation for 8 people
- **THEN** the system SHALL award bonus "host" points (e.g., 3x normal) and send a thank-you message acknowledging them as a great host

### Requirement: Menu exploration badges
The system SHALL track which menu categories a guest has tried and award badges for exploring the menu. Encourages guests to try new items.

#### Scenario: Guest tries all appetizers
- **WHEN** a guest's visit history (via manual staff input or POS data) shows they've ordered from every appetizer category
- **THEN** the system SHALL award the "Appetizer Explorer" badge and bonus points

#### Scenario: Guest checks their badges
- **WHEN** a guest asks "what badges do I have?" via WhatsApp
- **THEN** the system SHALL list all earned badges and show progress toward incomplete ones

### Requirement: Happy hour / off-peak gamification
The system SHALL support time-based bonus multipliers — extra points for visits during slow periods (e.g., Tuesday lunch, early dinner). Helps fill empty tables.

#### Scenario: Guest visits during off-peak
- **WHEN** a guest completes a visit during a configured off-peak window (e.g., Tuesday 12:00-15:00)
- **THEN** the system SHALL award double points and notify the guest: "Off-peak bonus! You earned 2x points today 🔥"

### Requirement: Birthday week challenge
The system SHALL automatically create a special birthday challenge for each guest — visit during your birthday week and earn a special reward + bonus points.

#### Scenario: Guest's birthday week starts
- **WHEN** it is 7 days before a guest's birthday
- **THEN** the system SHALL send a WhatsApp message: "Your birthday week challenge is live! Visit us this week for [special reward] + 3x points"

### Requirement: Leaderboard (opt-in)
The system SHALL support an optional monthly leaderboard showing top guests by points earned. Guests SHALL opt-in to appear on the leaderboard. Top 3 guests each month SHALL earn bonus rewards.

#### Scenario: Guest opts into leaderboard
- **WHEN** a guest asks to join the leaderboard
- **THEN** the system SHALL add them and show their current ranking

#### Scenario: Monthly leaderboard winner
- **WHEN** the month ends and the top 3 guests are determined
- **THEN** the system SHALL notify winners with their rewards and send a monthly leaderboard summary to all opted-in guests
