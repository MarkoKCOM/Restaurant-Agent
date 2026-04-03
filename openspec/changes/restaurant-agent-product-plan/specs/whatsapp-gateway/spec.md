## ADDED Requirements

### Requirement: Inbound message processing
The system SHALL receive and process inbound WhatsApp messages from guests. Messages SHALL be routed to the appropriate handler (reservation, inquiry, complaint, loyalty check).

#### Scenario: Guest sends reservation request in Hebrew
- **WHEN** a guest sends "אני רוצה להזמין שולחן ל-4 ביום שישי בשמונה בערב"
- **THEN** the system SHALL parse the intent, extract date/time/party size, and initiate the reservation flow in Hebrew

#### Scenario: Guest sends message in English
- **WHEN** a guest sends "I'd like to book a table for 2 tomorrow at 7pm"
- **THEN** the system SHALL respond in English and process the reservation

#### Scenario: Guest sends message in Arabic
- **WHEN** a guest sends a message in Arabic
- **THEN** the system SHALL detect the language and respond in Arabic

### Requirement: Outbound messaging
The system SHALL send outbound WhatsApp messages using pre-approved templates for transactional messages (confirmations, reminders) and session messages for conversational replies.

#### Scenario: Reservation confirmation
- **WHEN** a reservation is confirmed
- **THEN** the system SHALL send a WhatsApp template message with restaurant name, date, time, party size, and a modify/cancel link

#### Scenario: Reminder 3 hours before
- **WHEN** a reservation is 3 hours away
- **THEN** the system SHALL send a reminder with a one-tap confirm or cancel option

### Requirement: Conversation context
The system SHALL maintain conversation context within a session (24-hour WhatsApp window). Follow-up messages SHALL be understood in context.

#### Scenario: Multi-turn reservation
- **WHEN** a guest says "Book a table" then responds "Friday" then "4 people" then "8pm"
- **THEN** the system SHALL accumulate the details across turns and confirm the complete reservation

### Requirement: Media handling
The system SHALL handle inbound images and documents (e.g., event invitations, dietary requirement cards) and attach them to the guest profile or reservation.

#### Scenario: Guest sends dietary info image
- **WHEN** a guest sends a photo of their allergy card
- **THEN** the system SHALL acknowledge receipt and attach it as a note to their reservation

### Requirement: Owner/staff notifications
The system SHALL send real-time WhatsApp notifications to the owner/manager for important events (new reservation, cancellation, no-show, complaints, daily summary).

#### Scenario: Daily summary at closing
- **WHEN** the restaurant's configured closing time arrives
- **THEN** the system SHALL send the owner a summary: total covers, no-shows, cancellations, waitlist activity, and next day's preview

### Requirement: Baileys connection management
The system SHALL connect to WhatsApp via Baileys (WhatsApp Web multi-device protocol). Each restaurant SHALL have its own Baileys session with QR code pairing. The system SHALL handle reconnection, session persistence, and graceful degradation.

#### Scenario: Initial setup via QR code
- **WHEN** a new restaurant is onboarded
- **THEN** the system SHALL generate a QR code that the owner scans with the restaurant's WhatsApp to pair the bot

#### Scenario: Session disconnected
- **WHEN** the Baileys session drops (phone restart, network issue)
- **THEN** the system SHALL auto-reconnect using the stored session credentials and alert the owner only if reconnection fails after 3 attempts

### Requirement: Rate limiting and anti-ban
The system SHALL enforce rate limits on outbound messages to avoid WhatsApp detection: max 30 messages/minute, randomized delays between messages, no bulk blasts. Campaign messages SHALL be sent in batches with natural spacing.

#### Scenario: Campaign to 100 guests
- **WHEN** a campaign targets 100 guests
- **THEN** the system SHALL send messages in batches of 10-15 with 30-60 second random delays between batches
