## NEW Requirements

### Requirement: Owner onboarding wizard
The dashboard SHALL provide a first-run onboarding wizard so a new restaurant owner can configure the basics of their workspace on their own.

#### Scenario: Owner completes first-run setup
- GIVEN a new owner opens the onboarding wizard
- WHEN they move through owner account, restaurant details, hours, and tables steps
- THEN the wizard SHALL validate each step
- AND the owner SHALL be able to review and submit the full setup without leaving the dashboard

#### Scenario: Owner lands in a usable workspace
- GIVEN signup succeeds
- WHEN the owner is redirected into the dashboard
- THEN the owner SHALL be logged in automatically
- AND the workspace SHALL already contain their restaurant details and initial table setup
- AND the owner SHALL not need operator provisioning before using the dashboard

#### Scenario: New self-served tenant appears in platform admin view
- GIVEN a new owner completed self-serve onboarding
- WHEN a super-admin opens the restaurant picker
- THEN the new tenant SHALL appear as a selectable restaurant context
