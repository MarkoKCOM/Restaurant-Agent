# Reservation Detail Panel

## Overview

Add a slide-over panel to the dashboard that appears when a user clicks on a reservation row. The panel slides in from the left (RTL layout convention) and displays full reservation details with inline editing capabilities. Operators can modify date, time, party size, notes, and status, or cancel the reservation entirely. The panel also links to the guest's profile page.

## Requirements

- REQ-1: Clicking any reservation row in the reservations list or Today view opens a slide-over panel from the left side of the screen.
- REQ-2: The panel overlays the current view with a semi-transparent backdrop. Clicking the backdrop or pressing Escape closes the panel.
- REQ-3: Panel header shows the guest name and a close (X) button.
- REQ-4: Panel body displays the following fields: guest name (read-only), guest phone (read-only, clickable tel: link), date (editable date picker), time (editable time picker), party size (editable number input), status (editable dropdown: confirmed, seated, completed, cancelled, no-show), assigned tables (read-only list), notes (editable textarea).
- REQ-5: "Save" button sends `PATCH /api/v1/reservations/:id` with only the changed fields. Shows success toast on save, error toast on failure.
- REQ-6: "Cancel Reservation" button at the bottom sends `DELETE /api/v1/reservations/:id` after a confirmation dialog. On success, closes the panel and removes the reservation from the list.
- REQ-7: Guest name is a clickable link that navigates to `/guests/:guestId` (guest profile page).
- REQ-8: Panel animates in (slide from left, 300ms ease) and out (slide to left, 200ms ease).
- REQ-9: Panel width is 400px on desktop, full-width on mobile (< 768px).
- REQ-10: Loading state while fetching full reservation details (spinner or skeleton).

## Acceptance Criteria

- AC-1: Clicking a reservation row opens the slide-over panel with correct reservation data.
- AC-2: All read-only fields (guest name, phone, assigned tables) are displayed but not editable.
- AC-3: Changing the date and clicking Save sends a PATCH with the new date only.
- AC-4: Changing the status to "no-show" and saving updates the reservation status.
- AC-5: Editing the notes textarea and saving persists the new notes.
- AC-6: Clicking "Cancel Reservation" shows a confirmation dialog; confirming deletes the reservation and closes the panel.
- AC-7: After cancelling, the reservation is removed from the list without a full page reload.
- AC-8: Clicking the guest name navigates to the guest profile page.
- AC-9: Clicking the backdrop or pressing Escape closes the panel without saving.
- AC-10: The panel slides in from the left with animation.
- AC-11: On mobile viewports, the panel takes full width.

## API Changes

No new endpoints. Uses existing:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/reservations/:id` | Fetch full reservation detail |
| PATCH | `/api/v1/reservations/:id` | Update reservation fields |
| DELETE | `/api/v1/reservations/:id` | Cancel reservation |

## UI Changes

- New `ReservationDetailPanel` component (slide-over from left).
- Semi-transparent backdrop overlay (rgba(0,0,0,0.3)).
- Panel sections: header (guest name + close button), body (fields), footer (save + cancel buttons).
- Form fields: date picker, time picker, number input (party size), select dropdown (status), textarea (notes).
- Confirmation modal for cancel action.
- Success/error toasts for save and cancel operations.
- Responsive: 400px fixed width on desktop, 100vw on mobile.
