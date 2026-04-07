## MODIFIED Requirements

### Requirement: Central management console
The platform SHALL provide a central admin experience for managing all restaurant tenants.

#### Scenario: Admin views all restaurants
- **WHEN** a platform admin logs into the dashboard
- **THEN** they SHALL be able to view a list of all restaurant tenants
- **AND** they SHALL be able to select one restaurant as their active context

#### Scenario: Admin switches between restaurants
- **GIVEN** a platform admin is authenticated
- **WHEN** they switch from Restaurant A to Restaurant B in the dashboard UI
- **THEN** subsequent dashboard data requests SHALL use Restaurant B as the active tenant context
- **AND** the platform admin SHALL not need to log out and back in to switch
