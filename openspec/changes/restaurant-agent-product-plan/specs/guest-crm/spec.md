## ADDED Requirements

### Requirement: Guest profile creation
The system SHALL automatically create a guest profile when a guest makes their first reservation. Profile SHALL include: name, phone, email (optional), language preference, and source channel.

#### Scenario: Auto-create profile on first booking
- **WHEN** a new phone number makes a reservation via WhatsApp
- **THEN** the system SHALL create a guest profile with their name, phone, language detected, and source as "whatsapp"

### Requirement: Visit history tracking
The system SHALL automatically log every visit with date, time, party size, table assigned, and duration. Growth package SHALL also track estimated spend (if POS integrated) or manual spend entry.

#### Scenario: Guest completes visit
- **WHEN** staff marks a reservation as "completed" (guest departed)
- **THEN** the system SHALL log the visit to the guest's history with all details

### Requirement: Guest preferences and notes
The system SHALL allow staff and the AI agent to record guest preferences (dietary restrictions, seating preference, favorite dishes, occasion notes) and surface them on future visits.

#### Scenario: Guest mentions allergy during booking
- **WHEN** a guest says "my wife is allergic to nuts" during a WhatsApp booking conversation
- **THEN** the system SHALL save "nut allergy" to the guest profile and flag it on all future reservations

#### Scenario: Preferences shown on arrival
- **WHEN** staff views an arriving guest's reservation
- **THEN** the system SHALL display their preferences, visit count, and any notes

### Requirement: Guest segmentation
The system SHALL support tagging and segmenting guests by: visit frequency (new/returning/regular/VIP), spend level, last visit recency, source channel, and custom tags.

#### Scenario: Auto-tag regular guest
- **WHEN** a guest completes their 5th visit
- **THEN** the system SHALL automatically tag them as "regular"

#### Scenario: Owner filters high-value guests
- **WHEN** the owner requests "all guests who visited 3+ times in the last month"
- **THEN** the system SHALL return the matching guest list with contact info

### Requirement: Guest merge and deduplication
The system SHALL detect potential duplicate guests (same phone or name+similar details) and offer to merge profiles.

#### Scenario: Same guest books via widget and WhatsApp
- **WHEN** a guest books via the web widget with phone 054-1234567 and later messages on WhatsApp from the same number
- **THEN** the system SHALL link both interactions to the same guest profile

### Requirement: Data privacy and export
The system SHALL allow guests to request their data or deletion (GDPR/Israeli privacy law). Owners SHALL be able to export their guest database.

#### Scenario: Guest requests data deletion
- **WHEN** a guest requests their data be deleted
- **THEN** the system SHALL anonymize their profile and visit history within 30 days
