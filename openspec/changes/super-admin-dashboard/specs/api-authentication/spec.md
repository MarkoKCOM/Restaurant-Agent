## MODIFIED Requirements

### Requirement: Role-aware dashboard authentication
Dashboard authentication SHALL support both restaurant-scoped admins and platform-wide super admins.

#### Scenario: Restaurant admin logs in
- **WHEN** a restaurant admin submits valid credentials to `POST /api/v1/auth/login`
- **THEN** the API SHALL return a signed JWT containing `{ id, email, role, restaurantId }`
- **AND** `role` SHALL be `admin`
- **AND** the response SHALL include the user’s assigned restaurant object

#### Scenario: Super admin logs in
- **WHEN** a super admin submits valid credentials to `POST /api/v1/auth/login`
- **THEN** the API SHALL return a signed JWT containing `{ id, email, role, restaurantId }`
- **AND** `role` SHALL be `super_admin`
- **AND** `restaurantId` in the JWT SHALL be `null`
- **AND** the response SHALL include `restaurant: null`

### Requirement: Server-side tenant enforcement
Restaurant-scoped routes SHALL verify that the authenticated user is allowed to access the requested restaurant.

#### Scenario: Regular admin requests another restaurant
- **GIVEN** an authenticated user with `role=admin` and `restaurantId=A`
- **WHEN** they request data for restaurant `B`
- **THEN** the API SHALL reject the request with `403`

#### Scenario: Super admin selects restaurant context
- **GIVEN** an authenticated user with `role=super_admin`
- **WHEN** the dashboard sends `X-Restaurant-Id` with a valid restaurant ID
- **THEN** the API SHALL use that restaurant as the active request context for restaurant-scoped routes
- **AND** the header SHALL be ignored for non-super-admin users
