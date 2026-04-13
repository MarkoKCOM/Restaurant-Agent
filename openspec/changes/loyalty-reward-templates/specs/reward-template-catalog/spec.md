## ADDED Requirements

### Requirement: Rewards can store template guidance
The system SHALL allow rewards to store durable template guidance metadata alongside the reward itself.

#### Scenario: Owner creates reward from template
- WHEN an owner/admin creates a reward from a dashboard reward template
- THEN the saved reward SHALL persist a stable template key
- AND persist the guest moments that reward is best for
- AND persist example guest-facing pitch copy for supported languages

#### Scenario: Owner creates a custom reward
- WHEN an owner/admin creates a reward without using a template
- THEN the reward SHALL still save successfully without template metadata

### Requirement: Dashboard keeps loyalty strategy visible after save
The dashboard SHALL make saved rewards understandable as offers, not only as name-and-points rows.

#### Scenario: Saved reward list shows purpose
- WHEN an owner/admin reviews active or inactive rewards in the loyalty dashboard
- THEN the UI SHALL show any available template/moment/pitch guidance for each reward
- SO THAT the owner can still understand what situation the reward is meant for

### Requirement: Template catalog is shared, not component-local
The default reward-template library SHALL be defined in a shared reusable module.

#### Scenario: Dashboard uses shared template definitions
- WHEN the loyalty dashboard renders reward templates
- THEN it SHALL read from a shared catalog with stable keys and normalized moment tags
- AND that catalog SHALL be suitable for reuse by other OpenSeat surfaces
