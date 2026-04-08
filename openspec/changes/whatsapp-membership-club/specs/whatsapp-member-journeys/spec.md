## ADDED Requirements

### Requirement: WhatsApp-first club access
Guests SHALL be able to interact with the restaurant membership club through WhatsApp in natural language.

#### Scenario: Guest checks balance in WhatsApp
- WHEN a guest sends "how many points do I have?"
- THEN the system SHALL identify the guest in the restaurant context
- AND reply with their points balance, tier, and progress toward the next reward or milestone

#### Scenario: Guest checks status in Hebrew
- WHEN a guest sends "כמה נקודות יש לי?" or "אני חבר מועדון?"
- THEN the system SHALL respond in Hebrew with their membership status and relevant next-step guidance

### Requirement: Reward discovery and claiming in WhatsApp
Guests SHALL be able to discover and claim rewards through WhatsApp.

#### Scenario: Guest asks what they can redeem
- WHEN a guest asks "what can I redeem?"
- THEN the system SHALL list rewards available within their current balance
- AND explain the cost/value in guest-friendly language

#### Scenario: Guest claims a reward
- WHEN a guest chooses a reward in WhatsApp
- THEN the system SHALL create a redemption code or claim token
- AND send the guest clear instructions for using it at the restaurant
- AND make the claim visible to owner/staff operational surfaces

### Requirement: Referral flow in WhatsApp
Guests SHALL be able to use referral flows through WhatsApp.

#### Scenario: Guest requests referral code
- WHEN a guest asks to invite a friend
- THEN the system SHALL provide a reusable referral code or shareable referral message
- AND explain the benefit for the guest and the referred friend

#### Scenario: Referral success
- WHEN a referred guest completes the qualifying action
- THEN the system SHALL notify the referrer in WhatsApp that the referral reward was earned

### Requirement: Membership automation messages feel like club messages
Automated WhatsApp messages related to loyalty, streaks, rewards, or retention SHALL be framed as membership-club interactions rather than generic system notifications.

#### Scenario: Tier upgrade
- WHEN a guest reaches a higher tier
- THEN the system SHALL send a celebratory WhatsApp message explaining the new tier and what it unlocks

#### Scenario: Reward almost unlocked
- WHEN a guest is close to the next reward or milestone
- THEN the system SHALL send a timely WhatsApp nudge that encourages the next visit without sounding spammy

### Requirement: Guest messaging controls
Guests SHALL be able to opt out of non-transactional membership automation while still receiving essential reservation messages.

#### Scenario: Guest opts out of club marketing
- WHEN a guest asks to stop club/promotional messages
- THEN the system SHALL record the preference
- AND continue only essential transactional reservation communication unless the guest opts out more broadly
