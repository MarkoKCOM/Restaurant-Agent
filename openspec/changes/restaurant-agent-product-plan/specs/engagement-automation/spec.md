## ADDED Requirements

### Requirement: Post-visit thank you
The system SHALL automatically send a thank-you message via WhatsApp 2 hours after a guest's visit is marked as completed. The message SHALL be personalized with the guest's name and visit context.

#### Scenario: Thank you after dinner visit
- **WHEN** a guest's Friday dinner reservation is marked as completed at 22:00
- **THEN** the system SHALL send a thank-you message at 10:00 the next morning (respecting quiet hours) with their name and a warm closing

### Requirement: Review solicitation
The system SHALL prompt happy guests for Google Reviews. The system SHALL include a direct link to the restaurant's Google review page. Timing: 24 hours after visit for first-time guests, 2 hours after for regulars.

#### Scenario: First-time guest review prompt
- **WHEN** 24 hours have passed since a new guest's visit
- **THEN** the system SHALL send a WhatsApp message asking about their experience with a direct Google Review link

### Requirement: Complaint interception
The system SHALL detect negative sentiment in guest responses to engagement messages and route them to the owner instead of prompting for a public review.

#### Scenario: Guest responds negatively to thank-you message
- **WHEN** a guest replies "the food was cold and we waited 40 minutes" to a thank-you message
- **THEN** the system SHALL NOT send a review prompt, instead forward the complaint to the owner with guest details and suggest a recovery action

### Requirement: Birthday and anniversary automation
The system SHALL send automated greetings on guest birthdays and visit anniversaries (1-year since first visit). Messages SHALL include a personalized offer.

#### Scenario: Guest birthday
- **WHEN** it is a guest's birthday (stored in profile)
- **THEN** the system SHALL send a birthday greeting with a special offer (e.g., "Free dessert on your birthday visit this week!")

#### Scenario: One-year anniversary
- **WHEN** 365 days have passed since a guest's first visit
- **THEN** the system SHALL send an anniversary message with bonus points or a special offer

### Requirement: Win-back automation
The system SHALL automatically trigger win-back messages for guests who haven't visited in a configurable period (default: 30 days). Escalation: friendly reminder at 30 days, incentive offer at 60 days, final reach-out at 90 days.

#### Scenario: 30-day lapsed guest
- **WHEN** 30 days have passed since a regular guest's last visit
- **THEN** the system SHALL send a "We miss you" message with a soft invitation

#### Scenario: 60-day lapsed guest with incentive
- **WHEN** 60 days have passed and the guest didn't respond to the 30-day message
- **THEN** the system SHALL send a message with a concrete incentive (e.g., "Come back and get 15% off")
