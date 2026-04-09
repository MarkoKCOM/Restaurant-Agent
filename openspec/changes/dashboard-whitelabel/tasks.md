## 1. Shared domain + config model
- [x] 1.1 Expand `DashboardConfig` to support structured palette/branding fields with legacy compatibility
- [x] 1.2 Add normalization helpers for legacy `accentColor`/`logo` fallback
- [x] 1.3 Define typed feature/page visibility helpers so role and tenant config can be intersected safely

## 2. API normalization + persistence
- [x] 2.1 Validate and persist the richer `dashboardConfig` shape in restaurant update flows
- [x] 2.2 Normalize restaurant reads so legacy records continue to render correctly
- [ ] 2.3 Add tests for dashboard config read/write compatibility

## 3. Dashboard runtime theming
- [x] 3.1 Add a dashboard theme resolver that outputs normalized CSS variables
- [x] 3.2 Refactor layout/sidebar/header to consume theme tokens instead of hard-coded amber styling
- [x] 3.3 Refactor key owner-facing cards/buttons/badges to use semantic brand tokens where appropriate
- [x] 3.4 Ensure super admin global view stays platform-themed until a restaurant context is selected

## 4. Visibility + feature enforcement
- [x] 4.1 Centralize navigation visibility to: role access ∩ visible pages
- [x] 4.2 Enforce feature toggles for loyalty/guest notes/table-map style surfaces in the dashboard UI
- [x] 4.3 Add route-level fallback behavior for hidden pages

## 5. Settings UX
- [x] 5.1 Replace basic accent/logo controls with a brand editor (palette + branding assets)
- [x] 5.2 Add inline preview for sidebar/header/login treatment
- [x] 5.3 Add contrast validation and reset-to-default actions

## 6. Verification
- [ ] 6.1 Add/extend dashboard tests for role x brand x visibility combinations
- [x] 6.2 Run API type-check/build
- [x] 6.3 Run dashboard type-check/build
- [x] 6.4 Verify BFF default theme still renders correctly with migrated legacy config
