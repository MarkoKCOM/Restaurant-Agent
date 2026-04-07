## Context

OpenSeat is currently in a pilot phase with BFF Ra'anana as the only tenant, but the architecture and product plan already target a multi-restaurant platform. The current dashboard auth flow was intentionally simple for the pilot: a restaurant admin logs in and lands directly inside a single restaurant dashboard. That simplicity now gets in the way of platform operations.

At the same time, the backend should stop trusting client-provided tenant IDs. As more restaurants are added, route handlers need explicit server-side authorization for every restaurant-scoped read/write path.

## Goals / Non-Goals

**Goals**
- Introduce a platform-wide `super_admin` role
- Preserve existing UX for normal restaurant admins
- Let super-admin users select and switch an active restaurant context
- Enforce tenant access on the server for existing routes
- Seed or create a real super-admin account for internal use

**Non-Goals**
- Full back-office billing console
- Per-restaurant delegated multi-access matrix beyond `admin` vs `super_admin`
- Separate management app (we will role-gate the current dashboard first)
- Customer-facing permission management UI

## Decisions

### 1. Keep one users table, add role
**Decision:** Extend `admin_users` instead of introducing a separate `super_admins` table.

**Why:**
- Minimal migration from the current model
- One login path, one auth middleware, one dashboard auth context
- Easy to keep existing admins working while enabling platform-wide users

**Implementation:**
- Add `role` column with values `admin | super_admin`
- Make `restaurant_id` nullable for `super_admin`
- Keep existing rows as `role='admin'`

### 2. Selected restaurant lives in the dashboard session for super admins
**Decision:** Super-admin JWT authenticates the user, but the active tenant is chosen client-side and sent in `X-Restaurant-Id`.

**Why:**
- A platform admin can move between restaurants without re-logging
- Route code can still operate with a resolved restaurant context
- Avoids minting a new JWT every time the active restaurant changes

**Implementation:**
- JWT carries `{ id, email, role, restaurantId }`
- For `super_admin`, `restaurantId` in JWT is `null`
- Dashboard stores selected restaurant in localStorage
- Shared API helper includes `X-Restaurant-Id` when the authenticated user is `super_admin`

### 3. Enforce tenant access on the server
**Decision:** Add reusable tenant helpers and use them in restaurant-scoped routes.

**Why:**
- Prevent accidental or malicious cross-tenant data access
- Makes multi-tenant behavior explicit in code instead of implicit in the UI

**Implementation:**
- Add `requireRestaurantAccess(request, restaurantId)` helper
- Add `requireSuperAdmin(request)` helper
- Regular admins can only access their own `restaurantId`
- `X-Restaurant-Id` is ignored for non-super-admin users

### 4. Add a picker page before dashboard pages for super admins without context
**Decision:** Super admins log in to a restaurant picker first, not directly to `/today`.

**Why:**
- Prevents dashboard pages from loading with no tenant context
- Gives a clean place to show all restaurants and later expand into a management console

**Implementation:**
- New `/restaurants` page for super admins
- Sidebar shows current active restaurant and a switch action
- Regular admins keep current direct `/today` flow

## Risks / Trade-offs

- JWT shape changes may force users to log in again after deploy
- Adding server-side tenant checks can expose places where routes currently rely on unsafe client input
- The first version of the picker will look small while only one tenant exists, but that is acceptable because it establishes the right model now

## Migration Plan

1. Add OpenSpec change and implementation plan
2. Add DB migration for `role` and nullable `restaurant_id`
3. Update auth route + auth middleware
4. Add tenant enforcement helper and apply it to key restaurant-scoped routes
5. Add `GET /api/v1/admin/restaurants`
6. Update dashboard auth context, picker route, and switcher UI
7. Type-check/build
8. Seed/create super-admin and smoke test login
