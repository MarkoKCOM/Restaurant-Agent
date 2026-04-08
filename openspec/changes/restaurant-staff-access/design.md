## Overview

This change adds role-based dashboard access inside a restaurant while preserving the existing tenant model. The key shift is:
- tenant checks answer "which restaurant can this user touch?"
- role checks answer "what is this user allowed to do inside that restaurant?"

We already have tenant-safe auth helpers from the super-admin work. This change layers role authorization on top of that foundation.

## Role Model

### Technical roles
- `admin` — full restaurant access (owner/admin for now)
- `employee` — limited operational access for one restaurant
- `super_admin` — platform-wide OpenSeat operator

### Product meaning
- `admin` is the owner/manager role for the restaurant
- `employee` is floor staff / host / cashier style access

We keep `admin` as the full-access restaurant role to minimize migration and preserve existing seeded/admin accounts.

## Permission Model

### Restaurant admin (`admin`)
Allowed:
- Today page
- Reservations page + detail + lifecycle actions
- Waitlist page + offer/remove/accept operations
- Guests list and guest detail
- Loyalty / guest profile / insights visible through guest screens
- Settings page and restaurant/table configuration
- Any existing restaurant-scoped write routes unless explicitly platform-only

### Employee (`employee`)
Allowed:
- Today page
- Reservations page
- Reservation detail needed for service workflow
- Reservation lifecycle actions needed during service (`confirm`, `seat`, `complete`, `cancel`, `no_show`) subject to existing transition rules
- Walk-in creation
- Waitlist page and operational waitlist actions
- Table-status/dashboard snapshot data required by Today and service workflow

Blocked:
- Settings page
- Guests list and guest detail pages
- Restaurant configuration writes
- Table management writes
- Owner-oriented CRM, loyalty admin, engagement, and reset/admin endpoints
- Super-admin routes

### Super admin (`super_admin`)
Unchanged from current behavior; still chooses restaurant context and can access all restaurant/admin capabilities.

## API Design

### 1. Extend role enum
Current enum: `admin | super_admin`
New enum: `admin | employee | super_admin`

No rename of existing `admin` records is required.

### 2. Add authorization helpers
In `apps/api/src/middleware/auth.ts`, keep tenant helpers and add role helpers such as:
- `requireRole(user, allowedRoles)`
- `requireRestaurantAdmin(user)` for owner/admin-only endpoints
- `requireOperationalRole(user)` for `admin | employee | super_admin`

Pattern:
- first enforce tenant
- then enforce role

### 3. Protect routes by capability, not by page labels
Route grouping should roughly be:

Operational routes (`admin`, `employee`, `super_admin`)
- reservation list/detail/update/walk-in/no-show/cancel
- waitlist list/offer/remove/accept where authenticated staff is intended
- dashboard snapshot / table status

Owner-only routes (`admin`, `super_admin`)
- restaurant settings patch
- table CRUD
- guests list/detail/update/preferences/CRM actions
- loyalty admin/reward management
- engagement/admin jobs if surfaced in dashboard
- destructive restaurant reset/admin utilities

Platform-only routes (`super_admin`)
- current `/api/v1/admin/*` cross-restaurant controls

### 4. Login payload
`POST /api/v1/auth/login` should continue returning `role`, and optionally return a lightweight permission payload so the dashboard does not need to duplicate role mapping everywhere.

Preferred shape:
- `role`
- `restaurant`
- `permissions` object or a derived `dashboardAccess` object

Example:
- `pages: ["today", "reservations", "waitlist"]`
- `actions: ["reservation.manage", "walkin.create", "waitlist.manage"]`

This keeps frontend rendering and route guards aligned with backend policy.

## Dashboard Design

### Auth context
Extend `useAuth()` to expose a stable permission model derived from login response.

Suggested fields:
- `role`
- `permissions`
- helpers like `canAccess(pageKey)` and `can(actionKey)`

### Route guards
Add role-aware route wrappers, for example:
- `RequireOperationalAccess`
- `RequireAdminAccess`
- existing `SuperAdminRoute`

### Navigation
Sidebar should be filtered by permissions, not only by restaurant `dashboardConfig.visiblePages`.

Proposed merge rule:
- system role permissions define the hard maximum
- restaurant `visiblePages` can hide additional pages inside that max

So if an employee role does not have `settings`, restaurant config cannot accidentally re-enable it.

### Employee UI surface
For now employee users should see a simplified dashboard:
- Today
- Reservations
- Waitlist
- logout/language controls

Optional later:
- dedicated employee landing page / theme
- shift-oriented metrics instead of owner KPIs

## Migration Strategy

1. DB migration adds `employee` to `admin_role`
2. Existing `admin` and `super_admin` users remain unchanged
3. Seed/dev helpers can create an employee user for pilot testing
4. Dashboard consumes new role/permission payload but remains backward compatible if `permissions` is absent during rollout

## Risks

### Risk: frontend-only hiding without backend enforcement
Mitigation:
- every owner-only write/read route must enforce role checks server-side

### Risk: permission drift between API and dashboard
Mitigation:
- return permission payload from login and centralize frontend helpers around it

### Risk: over-restricting employees during service
Mitigation:
- explicitly classify service-floor actions as operational and verify with Today/Reservations/Waitlist workflows

## Verification Strategy

- API login smoke test for `admin`, `employee`, `super_admin`
- Permission smoke test for blocked employee endpoints (e.g. settings, guests, table CRUD)
- Dashboard login + route tests for employee vs admin navigation
- Manual service workflow test as employee:
  - open Today
  - create walk-in
  - update reservation statuses
  - manage waitlist
- Manual owner/admin workflow test:
  - access settings and guests successfully
