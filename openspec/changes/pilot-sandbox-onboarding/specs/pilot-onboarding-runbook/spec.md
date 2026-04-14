## NEW Requirements

### Requirement: Assisted pilot onboarding runbook
The platform SHALL define a repeatable pilot onboarding path for new restaurant prospects even before self-serve restaurant creation is productized.

#### Scenario: Prospect enters through marketing/demo path
- GIVEN a new restaurant owner wants to try OpenSeat
- WHEN they arrive through the current marketing site
- THEN they SHALL be able to reach a demo/contact entry point
- AND the operator SHALL be able to continue onboarding from there using the pilot runbook

#### Scenario: Owner receives a clean sandbox workspace
- GIVEN the operator provisions a sandbox tenant for onboarding
- WHEN the owner logs into the dashboard for the first time
- THEN they SHALL land in a clean restaurant workspace rather than the live pilot tenant
- AND they SHALL be able to complete first-run setup/testing without polluting another restaurant's data

#### Scenario: Gap is explicit until self-serve exists
- GIVEN the current product does not yet expose a self-serve restaurant creation endpoint or wizard
- WHEN pilot onboarding is run
- THEN the runbook SHALL describe the assisted provisioning step explicitly
- AND future product work can replace that step with a true self-serve onboarding flow without changing the rest of the pilot journey
