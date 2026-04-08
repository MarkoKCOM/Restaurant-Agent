## Restaurant Staff Access Tasks

### Spec / Planning
- [x] Add proposal for restaurant-scoped staff roles and role-based dashboard access
- [x] Add design doc for API authorization + dashboard role visibility
- [x] Add capability specs for staff roles, dashboard navigation, and service-floor operations

### Backend
- [x] Extend `admin_role` enum with `employee`
- [x] Keep existing `admin` users as full-access owner/admin accounts
- [x] Return role-aware permission payload from `POST /api/v1/auth/login`
- [x] Add shared role authorization helpers in `apps/api/src/middleware/auth.ts`
- [x] Apply role checks to owner-only routes (settings, tables, guests, loyalty admin, engagement/admin utilities)
- [x] Keep operational routes available to `admin`, `employee`, and `super_admin`
- [x] Add or update seed/provisioning flow for employee test users

### Frontend
- [x] Extend `useAuth()` with permissions/helpers derived from login response
- [x] Add role-aware route guards for operational vs owner/admin pages
- [x] Filter sidebar navigation by role permissions before applying restaurant `visiblePages`
- [x] Hide/block Guests and Settings for employees
- [x] Keep Today, Reservations, and Waitlist available for employees
- [x] Ensure operational actions (walk-ins, lifecycle actions, waitlist actions) remain visible for employees

### Verification
- [x] `pnpm --filter @openseat/api type-check`
- [x] `pnpm --filter @openseat/dashboard type-check`
- [x] `pnpm --filter @openseat/api build`
- [x] `pnpm --filter @openseat/dashboard build`
- [x] Smoke test API login for `admin`, `employee`, and `super_admin`
- [x] Smoke test forbidden employee access to guests/settings/table CRUD routes
- [x] Smoke test employee dashboard navigation and operational workflow
- [x] Smoke test admin dashboard full-access workflow

### Delivery
- [x] Implement on a feature branch
- [ ] Push branch
- [ ] Open PR with role matrix and rollout notes
