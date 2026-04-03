## ADDED Requirements

### Requirement: Audience segmentation for campaigns
The system SHALL allow owners to define campaign audiences based on guest attributes: visit frequency, recency, spend level, tier, tags, preferences, and custom filters.

#### Scenario: Target lapsed guests
- **WHEN** the owner creates a campaign targeting "guests who haven't visited in 30+ days"
- **THEN** the system SHALL compute the matching audience and show the count before sending

### Requirement: WhatsApp campaign delivery
The system SHALL send targeted WhatsApp campaigns using template messages. Campaigns SHALL support personalization (guest name, last visit date, points balance, reward teaser).

#### Scenario: Send weekend special campaign
- **WHEN** the owner schedules a campaign "Weekend Special: 20% off for returning guests" targeting Silver+ tier guests for Thursday at 16:00
- **THEN** the system SHALL send personalized WhatsApp messages to all matching guests at the scheduled time

#### Scenario: Campaign delivery tracking
- **WHEN** a campaign is sent to 150 guests
- **THEN** the system SHALL track delivered, read, and replied counts and report them to the owner

### Requirement: Campaign scheduling
The system SHALL support immediate and scheduled campaign delivery. Scheduled campaigns SHALL respect quiet hours (no messages before 09:00 or after 21:00 local time).

#### Scenario: Campaign scheduled during quiet hours
- **WHEN** the owner schedules a campaign for 22:30
- **THEN** the system SHALL warn that this is outside messaging hours and suggest 09:00 the next day

### Requirement: Campaign templates
The system SHALL provide pre-built campaign templates: "We miss you" (win-back), "Weekend special", "New menu item", "Birthday month offer", "Loyalty milestone approaching". Owners SHALL be able to customize text and create new templates.

#### Scenario: Owner uses win-back template
- **WHEN** the owner selects the "We miss you" template
- **THEN** the system SHALL pre-fill with a customizable message including the guest's name, days since last visit, and an incentive offer

### Requirement: Campaign rate limiting
The system SHALL enforce rate limits: maximum 2 campaigns per guest per week, maximum 4 per month. Guests SHALL be able to opt out.

#### Scenario: Guest opts out
- **WHEN** a guest replies "STOP" to a campaign message
- **THEN** the system SHALL immediately remove them from all future campaigns and confirm the opt-out
