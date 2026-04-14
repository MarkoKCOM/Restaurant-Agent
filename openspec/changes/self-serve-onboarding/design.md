## Overview

This is a pragmatic self-serve onboarding slice, not the final billing product.

The goal is simple:
- let a new owner create a restaurant from the dashboard
- collect enough setup data that the workspace is usable immediately
- log them in right away

We are not solving billing, WhatsApp connection, or menu upload in this tranche.
Those can come later.

## Flow Design

### Entry point
The dashboard login page gets a clear CTA for new restaurants.

Path:
- `/login` for existing users
- `/signup` for new restaurant onboarding

This keeps onboarding inside the dashboard product instead of bouncing users through the marketing site.

### Wizard steps
The signup wizard should be multi-step but lightweight.

Step 1 — Owner account
- owner/admin name
- email
- password
- password confirmation

Step 2 — Restaurant basics
- restaurant name
- cuisine type
- phone
- address
- package (`starter` or `growth`)
- locale
- timezone

Step 3 — Operating hours
- open/close per day
- allow closed days
- sensible defaults for missing days

Step 4 — Table setup
- repeatable rows for table name, min seats, max seats, optional zone
- require at least one table
- keep it simple instead of building a visual floor map now

Step 5 — Finish
- create restaurant + admin account
- return auth token and restaurant context
- store auth locally and route user into the live dashboard

## Backend Design

### Public signup endpoint
Add a public auth endpoint that accepts the onboarding payload and performs a single transaction:
1. validate owner and restaurant data
2. generate a unique restaurant slug from the restaurant name
3. insert restaurant row with sensible dashboard/widget defaults
4. insert admin user with bcrypt password hash and role `admin`
5. insert initial tables
6. return the same auth response shape as login

Using the same auth response shape avoids special-case frontend logic.

### Slug generation
Slug rules:
- derived from restaurant name
- lowercase, ASCII-safe, hyphenated
- if taken, append numeric suffix (`-2`, `-3`, etc.)

### Defaults
The signup flow should set practical defaults so the owner lands in a usable workspace:
- locale default `he`
- timezone default `Asia/Jerusalem`
- widget welcome text derived from restaurant name
- dashboard features enabled by default
- visible pages use the existing admin defaults

## Frontend Design

### Auth reuse
The frontend should reuse the existing auth storage model.
After successful signup, it should store:
- token
- role
- restaurant
- dashboardAccess

Then route to `/today`.

### Validation
Client-side validation should catch the obvious stuff before hitting the API:
- invalid email
- short password
- password mismatch
- missing restaurant name
- no tables configured
- invalid seat ranges
- incomplete open/close pair for an open day

API validation remains the source of truth.

## Verification

Minimum verification:
- create a fresh restaurant via public signup API
- confirm login payload includes token, admin role, and restaurant context
- confirm new restaurant appears in `/api/v1/restaurants`
- confirm new admin can log into live dashboard
- confirm dashboard Today/Settings/Tables render for the new tenant
- confirm super-admin restaurant picker includes the self-served tenant
