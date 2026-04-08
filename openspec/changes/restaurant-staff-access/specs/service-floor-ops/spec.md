## MODIFIED Requirements

### Requirement: Employees can perform service-floor reservation workflows
Employees SHALL be able to complete day-of-service actions needed to run the floor.

#### Scenario: Employee manages reservation lifecycle
- GIVEN an authenticated `employee`
- AND the employee is viewing a reservation in their own restaurant
- WHEN the employee uses a permitted lifecycle action
- THEN the API SHALL allow the action if the transition is otherwise valid
- AND lifecycle timestamps SHALL continue to behave the same as for admins

#### Scenario: Employee creates a walk-in
- GIVEN an authenticated `employee`
- WHEN the employee creates a walk-in for their restaurant
- THEN the API SHALL allow walk-in creation
- AND the new reservation SHALL appear in Today/Reservations views

#### Scenario: Employee manages waitlist operations
- GIVEN an authenticated `employee`
- WHEN the employee offers, accepts, or removes a waitlist entry in their restaurant
- THEN the API SHALL allow those operational actions

### Requirement: Employees are blocked from owner-only restaurant administration
Employees SHALL NOT be able to access configuration and CRM features that are meant for owners/admins.

#### Scenario: Employee requests guest CRM endpoints
- GIVEN an authenticated `employee`
- WHEN the employee requests owner-only guest list/detail/update endpoints
- THEN the API SHALL reject the request with a forbidden response

#### Scenario: Employee requests settings or table management endpoints
- GIVEN an authenticated `employee`
- WHEN the employee requests restaurant settings updates or table CRUD endpoints
- THEN the API SHALL reject the request with a forbidden response

#### Scenario: Admin retains owner workflow
- GIVEN an authenticated `admin`
- WHEN the admin uses settings, guest CRM, or table management features in their restaurant
- THEN the API SHALL continue to allow those flows

## Acceptance Criteria

- AC-1: Employee can log in and land on an operational dashboard experience
- AC-2: Employee can access Today, Reservations, and Waitlist without authorization errors
- AC-3: Employee cannot open Guests or Settings pages
- AC-4: Employee cannot call owner-only API endpoints successfully
- AC-5: Admin and super-admin behavior remains functional after the role split
