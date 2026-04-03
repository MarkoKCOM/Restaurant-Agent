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

### Requirement: WhatsApp Business API compliance
The system SHALL comply with Meta's WhatsApp Business Platform policies — template messages for outbound initiation, 24-hour session window for free-form replies, opt-in requirements.

#### Scenario: Outbound message outside session window
- **WHEN** the system needs to contact a guest outside the 24-hour window
- **THEN** the system SHALL use an approved template message, not a free-form message
