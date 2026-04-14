## NEW Requirements

### Requirement: Public restaurant signup
The platform SHALL allow a new restaurant owner to create a restaurant tenant and owner dashboard account without operator intervention.

#### Scenario: New owner creates restaurant account
- GIVEN a new restaurant owner opens the dashboard onboarding flow
- WHEN they submit valid owner details, restaurant details, operating hours, and at least one table
- THEN the system SHALL create a new restaurant tenant
- AND the system SHALL create a restaurant-scoped admin account for that owner
- AND the system SHALL return a valid authenticated dashboard session

#### Scenario: Restaurant slug collision
- GIVEN another restaurant already uses the derived slug for the submitted restaurant name
- WHEN signup completes
- THEN the system SHALL generate a unique slug automatically
- AND signup SHALL still succeed without forcing the owner to invent one manually

#### Scenario: Invalid signup payload
- GIVEN the signup payload is incomplete or invalid
- WHEN the owner submits it
- THEN the system SHALL reject the request with a validation error
- AND no partial tenant or admin account SHALL be created
