# WhatsApp Session Manager

## Overview

Build a Baileys-based WhatsApp session manager as the foundation for the AI restaurant agent. This sprint delivers the connection skeleton only: session lifecycle management, QR code generation for pairing, inbound message logging, and an outbound message helper. The session is not auto-started; an admin API endpoint controls start and stop. Session auth state is persisted to disk so reconnections do not require re-scanning the QR code.

## Requirements

- REQ-1: Install `@whiskeysockets/baileys` and its peer dependency `@hapi/boom` in the `apps/api` workspace.
- REQ-2: Create `apps/api/src/whatsapp/session.ts` with functions: `startSession(restaurantId)`, `stopSession(restaurantId)`, `getSessionStatus(restaurantId)`, `getQRCode(restaurantId)`.
- REQ-3: `startSession` initializes a Baileys `makeWASocket` connection. Auth state is loaded from and saved to `/home/jake/sable/.whatsapp-session/<restaurantId>/` using Baileys' `useMultiFileAuthState`.
- REQ-4: On `connection.update` event with QR code, store the QR string in memory so it can be retrieved via `getQRCode`.
- REQ-5: On successful connection (connection state `open`), log "WhatsApp connected for restaurant <restaurantId>" to console.
- REQ-6: On disconnection, log the reason and do NOT auto-reconnect (operator must explicitly restart).
- REQ-7: Create `apps/api/src/whatsapp/handler.ts` with a `handleIncomingMessage(message, restaurantId)` function. For this sprint, it only logs the sender JID, message type, and text content to console. Returns void.
- REQ-8: Create `apps/api/src/whatsapp/sender.ts` with a `sendMessage(restaurantId, jid, text)` function that sends a text message via the active Baileys socket for that restaurant. Throws if no active session.
- REQ-9: Admin API endpoints (all require auth):
  - `POST /api/v1/whatsapp/:restaurantId/start` — starts a session, returns `{ status: 'starting' }`.
  - `POST /api/v1/whatsapp/:restaurantId/stop` — stops the session, returns `{ status: 'stopped' }`.
  - `GET /api/v1/whatsapp/:restaurantId/status` — returns `{ status: 'disconnected' | 'connecting' | 'connected', qr: string | null }`.
- REQ-10: Session state directory `/home/jake/sable/.whatsapp-session/` is created automatically if it does not exist. This path must be in `.gitignore`.
- REQ-11: The WhatsApp module is NOT imported or started during normal API boot. It is only activated when the admin calls the start endpoint.
- REQ-12: Only one session per restaurant is allowed at a time. Calling start on an already-running session returns `409 { error: "Session already active" }`.

## Acceptance Criteria

- AC-1: `POST /api/v1/whatsapp/:restaurantId/start` returns 200 with `{ status: 'starting' }` and initiates a Baileys connection.
- AC-2: `GET /api/v1/whatsapp/:restaurantId/status` returns `connecting` and a QR code string before the phone is paired.
- AC-3: After scanning the QR code with a phone, status changes to `connected` and QR becomes null.
- AC-4: `POST /api/v1/whatsapp/:restaurantId/stop` disconnects the session and status returns `disconnected`.
- AC-5: Auth state files are written to `/home/jake/sable/.whatsapp-session/<restaurantId>/`.
- AC-6: Restarting a previously paired session reconnects without requiring a new QR scan.
- AC-7: Incoming messages are logged to console with sender JID, message type, and text.
- AC-8: `sendMessage` successfully sends a text message through an active session.
- AC-9: `sendMessage` throws an error when no session is active for the given restaurant.
- AC-10: Calling start on an already-active session returns 409.
- AC-11: The WhatsApp module does not initialize on API startup (no Baileys connection until explicitly started).
- AC-12: `.whatsapp-session/` directory is listed in `.gitignore`.

## API Changes

| Method | Path | Auth | Request Body | Response |
|--------|------|------|-------------|----------|
| POST | `/api/v1/whatsapp/:restaurantId/start` | Required (admin) | None | `200 { status: 'starting' }` or `409 { error: 'Session already active' }` |
| POST | `/api/v1/whatsapp/:restaurantId/stop` | Required (admin) | None | `200 { status: 'stopped' }` |
| GET | `/api/v1/whatsapp/:restaurantId/status` | Required (admin) | None | `200 { status: string, qr: string \| null }` |

## File Structure

```
apps/api/src/whatsapp/
  session.ts    — Baileys connection lifecycle, auth state persistence, QR storage
  handler.ts    — Inbound message handler (stub: console.log only)
  sender.ts     — Outbound message helper
  routes.ts     — Fastify route definitions for start/stop/status endpoints
  index.ts      — Module barrel export
```

## Configuration

- Session state path: `/home/jake/sable/.whatsapp-session/<restaurantId>/`
- No new environment variables required (Baileys connects directly to WhatsApp servers).
- `.gitignore` addition: `.whatsapp-session/`
