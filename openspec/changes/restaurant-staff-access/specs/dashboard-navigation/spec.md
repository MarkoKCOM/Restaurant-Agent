## MODIFIED Requirements

### Requirement: Dashboard navigation reflects authenticated role
The dashboard SHALL show only the pages allowed for the current authenticated role.

#### Scenario: Employee sees operational navigation only
- GIVEN an authenticated `employee` user with an active restaurant
- WHEN the dashboard layout renders
- THEN navigation SHALL include Today, Reservations, and Waitlist
- AND it SHALL NOT include Guests or Settings
- AND it SHALL NOT expose super-admin restaurant switching controls

#### Scenario: Restaurant admin sees full restaurant navigation
- GIVEN an authenticated `admin` user with an active restaurant
- WHEN the dashboard layout renders
- THEN navigation SHALL include the current owner/admin pages for that restaurant

#### Scenario: Restaurant config cannot widen role access
- GIVEN a restaurant dashboard config includes visible pages outside the employee role
- WHEN an `employee` user opens the dashboard
- THEN the dashboard SHALL still hide any page not allowed by the employee role

### Requirement: Dashboard routes are role-guarded
The dashboard SHALL block direct URL navigation to unauthorized pages.

#### Scenario: Employee opens settings URL directly
- GIVEN an authenticated `employee`
- WHEN the employee navigates directly to `/settings`
- THEN the dashboard SHALL redirect or block access
- AND it SHALL NOT render the settings screen

#### Scenario: Employee opens guest detail URL directly
- GIVEN an authenticated `employee`
- WHEN the employee navigates directly to `/guests/:id`
- THEN the dashboard SHALL redirect or block access
- AND it SHALL NOT render the guest CRM detail screen
