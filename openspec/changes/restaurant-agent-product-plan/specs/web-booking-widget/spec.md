## ADDED Requirements

### Requirement: Embeddable booking widget
The system SHALL provide an embeddable JavaScript widget that restaurant owners can add to their website with a single script tag. The widget SHALL show real-time availability and allow guests to complete a booking.

#### Scenario: Guest books via website widget
- **WHEN** a guest selects date, time, and party size on the widget and submits their name and phone number
- **THEN** the system SHALL create the reservation and show a confirmation with reservation ID

#### Scenario: Widget shows unavailable times as disabled
- **WHEN** a guest opens the widget for a fully booked Friday evening
- **THEN** the system SHALL show those time slots as unavailable and suggest the nearest open slots

### Requirement: Mobile-responsive design
The widget SHALL be fully responsive and optimized for mobile devices (60%+ of restaurant website traffic is mobile).

#### Scenario: Widget on mobile phone
- **WHEN** a guest opens the restaurant website on a mobile phone
- **THEN** the widget SHALL render as a full-screen overlay with touch-friendly date/time pickers

### Requirement: Customizable branding
The widget SHALL support restaurant-specific branding — logo, primary color, font, and custom welcome message.

#### Scenario: Owner customizes widget appearance
- **WHEN** the owner sets their brand color to #8B0000 and uploads their logo
- **THEN** the widget SHALL render with that color scheme and logo

### Requirement: Google Business integration
The system SHALL generate a direct booking link compatible with Google Business Profile's "Reserve" button.

#### Scenario: Guest clicks Reserve on Google Maps
- **WHEN** a guest clicks the Reserve button on the restaurant's Google Business listing
- **THEN** they SHALL be directed to the booking widget with the restaurant pre-selected

### Requirement: No account required
Guests SHALL NOT need to create an account or download an app to make a reservation via the widget. Phone number and name are sufficient.

#### Scenario: First-time guest books without signup
- **WHEN** a guest with no prior history enters their name and phone number
- **THEN** the system SHALL create the reservation and a guest profile automatically
