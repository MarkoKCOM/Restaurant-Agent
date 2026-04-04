# Settings Editor

## Overview

Build a full settings editing experience in the dashboard that allows restaurant operators to configure operating hours and manage their table inventory. Operating hours use a 7-row grid (Sunday through Saturday) with open/close time pickers and a closed toggle per day. The table editor supports adding, removing, and editing tables with name, seat range, and zone. All changes persist via existing API endpoints.

## Requirements

- REQ-1: Dashboard Settings page at `/settings` with two sections: "Operating Hours" and "Tables".
- REQ-2: Operating Hours section displays a 7-row grid, one row per day (Sunday first, per Israeli convention).
- REQ-3: Each row shows: day label, "Closed" toggle, open time input, close time input. When "Closed" is toggled on, the time inputs are disabled and greyed out.
- REQ-4: Time inputs use 24-hour format with 15-minute increments (e.g., 09:00, 09:15, ..., 23:45).
- REQ-5: Save button sends `PATCH /api/v1/restaurants/:id` with `{ operatingHours: { sun: { open, close, closed }, mon: {...}, ... } }` updating the restaurant's `operatingHours` JSONB column.
- REQ-6: Table editor section lists all tables for the restaurant, fetched via `GET /api/v1/tables?restaurantId=X`.
- REQ-7: Each table row is editable inline: name (text), minSeats (number), maxSeats (number), zone (text or dropdown).
- REQ-8: "Add Table" button appends an empty row. On save, calls `POST /api/v1/tables`.
- REQ-9: "Remove" button per table row calls `DELETE /api/v1/tables/:id` with a confirmation prompt.
- REQ-10: Editing an existing table and clicking save calls `PATCH /api/v1/tables/:id`.
- REQ-11: Validation: minSeats must be >= 1, maxSeats must be >= minSeats, name is required.
- REQ-12: Show success toast on save, error toast on failure.

## Acceptance Criteria

- AC-1: Settings page loads and displays current operating hours from the restaurant record.
- AC-2: Toggling a day to "Closed" disables time inputs for that day and saves `closed: true` for that day.
- AC-3: Changing open/close times and clicking Save sends a PATCH with the updated operatingHours JSONB.
- AC-4: After saving operating hours, reloading the page shows the updated values.
- AC-5: Table list displays all tables with their current name, minSeats, maxSeats, and zone.
- AC-6: Adding a new table via "Add Table", filling in fields, and saving creates the table via POST.
- AC-7: Editing an existing table's name and saving sends a PATCH to the correct table ID.
- AC-8: Removing a table shows a confirmation dialog; confirming deletes it via DELETE.
- AC-9: Validation prevents saving a table with minSeats > maxSeats or empty name.
- AC-10: Success and error toasts appear after save operations.

## API Changes

No new endpoints. Uses existing:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/restaurants/:id` | Load current operating hours |
| PATCH | `/api/v1/restaurants/:id` | Update operating hours JSONB |
| GET | `/api/v1/tables?restaurantId=X` | List tables |
| POST | `/api/v1/tables` | Create table |
| PATCH | `/api/v1/tables/:id` | Update table |
| DELETE | `/api/v1/tables/:id` | Remove table |

## UI Changes

- `/settings` page with two card sections stacked vertically.
- **Operating Hours card**: 7-row grid. Columns: Day (label), Closed (toggle switch), Open (time select), Close (time select). "Save Hours" button below the grid.
- **Tables card**: Editable table list. Columns: Name (text input), Min Seats (number input), Max Seats (number input), Zone (text input), Actions (save/remove buttons). "Add Table" button below the list.
- Responsive layout: on mobile, each day row stacks vertically.

## Data Format

`operatingHours` JSONB structure:

```json
{
  "sun": { "open": "11:00", "close": "23:00", "closed": false },
  "mon": { "open": "11:00", "close": "23:00", "closed": false },
  "tue": { "open": "11:00", "close": "23:00", "closed": false },
  "wed": { "open": "11:00", "close": "23:00", "closed": false },
  "thu": { "open": "11:00", "close": "23:00", "closed": false },
  "fri": { "open": "11:00", "close": "15:00", "closed": false },
  "sat": { "open": "00:00", "close": "00:00", "closed": true }
}
```
