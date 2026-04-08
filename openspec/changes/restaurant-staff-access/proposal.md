## Why

The dashboard currently assumes one restaurant-scoped role with full access (`admin`) plus the platform-wide `super_admin`. That is too coarse for real restaurant operations. A restaurant owner/manager should be able to access settings, guest CRM, and business configuration, while front-of-house employees should only see the operational screens they need to run service.

Right now visibility is mostly driven by frontend navigation and restaurant dashboard config (`visiblePages`), not by a real permission model. That means we do not yet have a durable way to create separate logins for employees with a reduced interface and reduced server-side capabilities.

## What Changes

- Add a restaurant-scoped `employee` role alongside the current full-access `admin` role
- Treat current `admin` as the owner/admin role for now (full restaurant access)
- Return role-aware permissions in dashboard auth responses
- Add server-side authorization helpers for role-based access, not just tenant checks
- Restrict dashboard pages and actions based on role
- Keep `super_admin` for platform operators unchanged

## Scope Assumption

For now there are only two restaurant-scoped access levels:
- `admin` = owner/admin (full access for that restaurant)
- `employee` = operations-only access

Platform role remains:
- `super_admin` = OpenSeat operator across restaurants

## Capabilities

### New Capabilities
- `restaurant-staff-roles`: restaurants can create employee logins with restricted dashboard access

### Modified Capabilities
- `api-authentication`: authenticated dashboard identity becomes permission-aware, not only tenant-aware
- `service-floor-ops`: employee users can operate reservations/waitlist without seeing owner-only areas
- `dashboard-navigation`: sidebar, routes, and actions reflect the authenticated role

## Impact

- DB migration for `admin_role`
- Auth/login payload changes
- Shared authorization helpers in the API
- Dashboard auth context + route guards + layout filtering
- Page/action-level permission checks for reservations, guests, settings, loyalty, and other owner-only features
