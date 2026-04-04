# Widget Branding

## Overview

Enhance the booking widget to dynamically apply restaurant-specific branding and configuration. On mount, the widget fetches the restaurant record and uses its `primaryColor`, `welcomeText`, and `logo` fields to style the interface. Additionally, enforce Israeli phone number validation on the client and block past-date reservations on the server.

## Requirements

- REQ-1: On widget mount, fetch `GET /api/v1/restaurants/:id` (the restaurant ID is passed as a prop or URL parameter to the widget).
- REQ-2: Apply the restaurant's `primaryColor` to all buttons, active states, and accent elements (links, focus rings, selected date highlights). Use CSS custom properties for easy theming.
- REQ-3: Display the restaurant's `welcomeText` as the widget header text. Falls back to "Book a Table" if not set.
- REQ-4: If the restaurant has a `logo` URL, display it as a header image above the welcome text. If no logo, show only the text.
- REQ-5: Phone input validates Israeli phone format: accepts `05X-XXXXXXX`, `05XXXXXXXX`, `+9725XXXXXXXX`, or `+972-5X-XXXXXXX`. Show inline validation error for invalid formats.
- REQ-6: Server-side validation in `POST /api/v1/reservations`: reject requests where `date` is before today (server's date, not client's). Return `400 { error: "Cannot book a past date" }`.
- REQ-7: Widget date picker disables past dates on the client side as well (defense in depth).
- REQ-8: Show a loading skeleton while the restaurant config is being fetched.
- REQ-9: If the restaurant fetch fails, show a generic error state ("Booking unavailable, please try again later").
- REQ-10: Ensure the `primaryColor` meets WCAG AA contrast ratio against white background for button text. If contrast is insufficient, use white text on the primary color background.

## Acceptance Criteria

- AC-1: Widget loads and displays the restaurant's `welcomeText` as the header.
- AC-2: Buttons and accent elements use the restaurant's `primaryColor`.
- AC-3: Restaurant logo appears as a header image when the `logo` field is set.
- AC-4: No logo image renders when the restaurant has no `logo` value.
- AC-5: Entering `052-1234567` in the phone field passes validation.
- AC-6: Entering `+972521234567` in the phone field passes validation.
- AC-7: Entering `1234567890` (non-Israeli format) shows an inline validation error.
- AC-8: Submitting a reservation with yesterday's date returns 400 from the server.
- AC-9: The date picker does not allow selecting dates before today.
- AC-10: A loading skeleton is shown while fetching restaurant data.
- AC-11: If the restaurant fetch returns an error, a user-friendly error message is displayed.

## API Changes

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/v1/reservations` | Add server-side validation: reject `date < today` with `400 { error: "Cannot book a past date" }` |

No new endpoints. `GET /api/v1/restaurants/:id` already exists and returns `primaryColor`, `welcomeText`, `logo`.

## UI Changes

- Widget header: optional logo image + welcome text (from restaurant config).
- All interactive elements (buttons, date highlights, focus rings) themed with `--sable-primary-color` CSS variable.
- Phone input: inline validation message "Please enter a valid Israeli phone number" below the field.
- Date picker: past dates greyed out and unselectable.
- Loading state: skeleton placeholder matching the widget layout.
- Error state: centered message with subtle icon when restaurant config cannot be loaded.
