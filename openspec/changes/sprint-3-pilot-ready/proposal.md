## Why

Sprint 1-2 delivered a working reservation engine, dashboard, and booking widget — but the system has critical gaps that prevent a real pilot launch with BFF Ra'anana. There is zero authentication (any HTTP client can read/write all data), no way for the owner to edit operating hours from the dashboard, no reservation edit modal, and the booking widget ignores branding config. The pilot restaurant owner cannot use this without these fixes. Additionally, the waitlist feature (schema exists, zero logic) and WhatsApp integration (Phase 1b) are needed to deliver on the product promise.

## What Changes

- **Add JWT authentication** to all API routes — login endpoint, middleware, dashboard auth flow
- **Settings hours editor** — owner can edit operating hours per day from dashboard UI
- **Reservation detail/edit modal** — click a reservation row to view details, edit date/time/party/notes
- **Widget branding** — apply restaurant's widgetConfig (primaryColor, logo, welcomeText) to the booking widget
- **Waitlist engine** — add to waitlist when fully booked, auto-match on cancellation, 15-min offer expiry
- **Guest preference editor** — edit preferences, tags, notes from guest detail page
- **SSL/HTTPS** — certbot for nginx, redirect HTTP to HTTPS
- **Stale docs update** — ROADMAP.md, ARCHITECTURE.md reflect actual state
- **Prepare Phase 1b** — Baileys WhatsApp session manager skeleton, agent tool schemas

## Capabilities

### New Capabilities
- `api-authentication`: JWT-based auth for all API routes, login endpoint, dashboard auth integration
- `waitlist-engine`: Waitlist auto-match on cancellation, offer expiry (15min), notification hooks
- `settings-editor`: Full CRUD for operating hours, table management, and widget branding from dashboard
- `reservation-detail`: Reservation view/edit modal with date/time/party size modification
- `widget-branding`: Apply restaurant widgetConfig to booking widget styling and content
- `whatsapp-session`: Baileys WhatsApp session manager skeleton — QR pairing, reconnect, message receive/send

### Modified Capabilities
- `reservation-engine`: Add waitlist integration — on cancellation, check waitlist and offer freed slot
- `guest-crm`: Add preference/tag/note editing UI in dashboard guest detail page
- `web-booking-widget`: Apply branding config, add phone validation, block past dates server-side

## Impact

- **API**: New `/api/v1/auth/login` endpoint, JWT middleware on all routes, new waitlist routes
- **Dashboard**: Auth gate (login page), hours editor component, reservation modal, guest edit panel
- **Widget**: Fetch and apply widgetConfig, stricter input validation
- **Infrastructure**: SSL certificates via certbot, nginx HTTPS config
- **Dependencies**: `jsonwebtoken` + `bcrypt` for auth, `@whiskeysockets/baileys` for WhatsApp skeleton
- **Database**: No schema changes needed (waitlist table already exists)
