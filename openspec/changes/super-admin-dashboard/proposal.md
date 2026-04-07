## Why

The current dashboard login model is single-restaurant only. Every `admin_users` record is bound to one restaurant, the JWT always carries one `restaurantId`, and the dashboard assumes that every authenticated user belongs to exactly one tenant. That blocks the product direction we already documented in OpenSpec: the platform needs a central admin experience where a platform operator can see all restaurants and move between them.

There is also a more serious issue hiding inside the current implementation: tenant isolation is mostly happening by convention in the frontend. Many API routes trust the client-supplied `restaurantId` and do not consistently enforce that the authenticated user is allowed to access that tenant. Before onboarding more restaurants, that needs to be fixed properly.

## What Changes

- Add a real `super_admin` role to authenticated dashboard users
- Allow super-admin accounts to exist without being tied to a single restaurant row
- Return role-aware login responses from the API
- Add server-side tenant enforcement for restaurant-scoped routes
- Add a super-admin restaurant list endpoint for dashboard context switching
- Add dashboard UX for selecting and switching active restaurants
- Keep current restaurant-admin behavior unchanged for existing operators

## Capabilities

### New Capabilities
- `super-admin-dashboard`: Platform admin can log in, view all restaurants, pick an active restaurant, and switch context without re-authenticating

### Modified Capabilities
- `api-authentication`: JWT now carries role-aware identity and supports super-admin sessions
- `multi-restaurant`: central admin console starts with restaurant selection and tenant switching in the dashboard

## Impact

- Database migration on `admin_users`
- Auth middleware becomes role-aware
- New admin API route(s)
- Dashboard auth context and routing changes
- Improved tenant isolation enforcement on existing API routes
