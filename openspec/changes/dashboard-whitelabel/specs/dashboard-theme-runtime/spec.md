## ADDED Requirements

### Requirement: Dashboard runtime theming
The dashboard SHALL render restaurant-specific branding through a normalized runtime theme rather than scattered hard-coded brand classes.

#### Scenario: Restaurant opens dashboard after branding setup
- GIVEN a restaurant has a saved dashboard brand kit
- WHEN an authenticated user opens the dashboard
- THEN the application root SHALL apply normalized brand CSS variables
- AND shared layout/page components SHALL consume those variables for restaurant-facing styling

#### Scenario: Super admin without restaurant context
- WHEN a super admin is not currently scoped into a restaurant
- THEN the dashboard SHALL use the platform default theme
- AND restaurant white-label styling SHALL not leak into the global picker view

### Requirement: Page visibility respects role and tenant config together
Dashboard visibility SHALL be derived from both role permissions and restaurant configuration.

#### Scenario: Employee has operational access but restaurant hides a page
- GIVEN an employee role is allowed to view a page in general
- AND the restaurant has disabled that page from its visible dashboard pages
- WHEN the employee logs in
- THEN the page SHALL not appear in navigation
- AND direct navigation to that page SHALL redirect to an allowed fallback page

#### Scenario: Admin can see features enabled for the tenant
- GIVEN an admin has permission to access owner pages
- AND the restaurant has enabled the relevant dashboard page/feature
- WHEN the admin logs in
- THEN the page SHALL appear in navigation
- AND linked feature surfaces SHALL render consistently

### Requirement: Feature toggles are enforced consistently
Restaurant dashboard feature toggles SHALL not be cosmetic-only.

#### Scenario: Loyalty feature disabled for a restaurant
- WHEN the restaurant disables loyalty-related dashboard features
- THEN loyalty panels and entry points SHALL be hidden from the dashboard UI
- AND the user experience SHALL not expose dead controls for disabled features
