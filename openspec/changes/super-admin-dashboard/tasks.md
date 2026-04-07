## Super Admin Dashboard Tasks

### Spec / Planning
- [x] Add proposal for super-admin dashboard and tenant-safe auth
- [x] Add design doc for role-aware auth and restaurant switching
- [ ] Add capability specs for auth and multi-restaurant admin behavior

### Backend
- [ ] Add `role` to `admin_users` and make `restaurant_id` nullable for `super_admin`
- [ ] Generate and apply Drizzle migration
- [ ] Make login response role-aware in `apps/api/src/routes/auth.ts`
- [ ] Make auth middleware role-aware in `apps/api/src/middleware/auth.ts`
- [ ] Add tenant enforcement helper(s)
- [ ] Apply tenant enforcement to restaurant-scoped routes
- [ ] Add `GET /api/v1/admin/restaurants` for super admins
- [ ] Seed/create a real super-admin user

### Frontend
- [ ] Extend dashboard auth context with `role` and active restaurant state
- [ ] Add `/restaurants` picker page for super admins
- [ ] Add sidebar switcher / context selector for super admins
- [ ] Attach `X-Restaurant-Id` in shared API helper for super-admin requests
- [ ] Keep regular admin flow unchanged

### Verification
- [ ] `pnpm --filter @openseat/api type-check`
- [ ] `pnpm --filter @openseat/dashboard type-check`
- [ ] `pnpm --filter @openseat/api build`
- [ ] `pnpm --filter @openseat/dashboard build`
- [ ] Smoke test API login for regular admin and super admin
- [ ] Smoke test browser login + restaurant selection flow

### Delivery
- [ ] Commit changes on feature branch
- [ ] Push branch
- [ ] Open PR with rollout notes and risks
