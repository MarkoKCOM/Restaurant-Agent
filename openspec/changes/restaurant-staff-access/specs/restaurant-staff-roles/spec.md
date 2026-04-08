## ADDED Requirements

### Requirement: Restaurant can authenticate employee dashboard users
The system SHALL support restaurant-scoped employee users in addition to the existing full-access admin users.

#### Scenario: Employee login succeeds
- GIVEN an `admin_users` record exists with role `employee`
- AND the user belongs to restaurant `R`
- WHEN the employee submits valid dashboard credentials
- THEN the API SHALL authenticate successfully
- AND the login response SHALL include `role=employee`
- AND the session SHALL remain scoped to restaurant `R`

#### Scenario: Existing admin login remains unchanged
- GIVEN an existing full-access restaurant dashboard user with role `admin`
- WHEN that user logs in
- THEN authentication SHALL continue to succeed without migration-side manual fixes
- AND the login response SHALL identify the user as full-access for that restaurant

### Requirement: Login response exposes dashboard permissions
The system SHALL return a stable role/permission representation so the dashboard can render the correct navigation and actions.

#### Scenario: Employee receives operational permission set
- GIVEN an employee dashboard user logs in
- WHEN the login response is returned
- THEN it SHALL include enough role/permission data for the dashboard to determine that the user can access operational screens only

#### Scenario: Admin receives full restaurant permission set
- GIVEN a restaurant admin logs in
- WHEN the login response is returned
- THEN it SHALL include enough role/permission data for the dashboard to determine that the user can access owner/admin screens for that restaurant

## MODIFIED Requirements

### Requirement: Auth middleware supports restaurant staff roles
The auth middleware SHALL preserve tenant checks while also supporting role checks for `admin`, `employee`, and `super_admin`.

#### Scenario: Employee cannot elevate tenant scope
- GIVEN an authenticated employee belongs to restaurant `R`
- WHEN the employee calls a restaurant-scoped route with another restaurant ID
- THEN the API SHALL reject the request
- AND it SHALL not use the foreign tenant context

#### Scenario: Super admin behavior remains intact
- GIVEN an authenticated `super_admin`
- WHEN the super admin chooses an active restaurant context
- THEN existing cross-restaurant behavior SHALL continue to work as before
