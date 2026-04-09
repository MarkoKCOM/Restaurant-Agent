## ADDED Requirements

### Requirement: Restaurant-scoped dashboard brand kit
The system SHALL allow each restaurant to define its own dashboard brand kit, stored in `dashboardConfig`, without requiring a separate build or deployment.

#### Scenario: Restaurant defines its dashboard identity
- WHEN an owner/admin saves a dashboard brand kit for their restaurant
- THEN the restaurant record SHALL persist the brand configuration
- AND future dashboard sessions for that restaurant SHALL load that configuration automatically

#### Scenario: Legacy dashboard config still works
- GIVEN a restaurant only has legacy `accentColor` and `logo` fields
- WHEN the dashboard loads
- THEN the system SHALL derive a safe default brand kit from those values
- AND the dashboard SHALL render without regression

### Requirement: Brand kit includes palette and branding assets
The dashboard brand kit SHALL support more than a single accent color.

#### Scenario: Owner configures palette and logo
- WHEN an owner/admin sets a primary color, sidebar color, surface accent, and logo
- THEN the dashboard SHALL expose those values through normalized theme tokens
- AND the restaurant dashboard SHALL render using those tokens consistently

#### Scenario: Missing optional assets
- WHEN a restaurant omits optional fields such as wordmark or login image
- THEN the dashboard SHALL fall back to safe defaults
- AND the UI SHALL not render broken image placeholders

### Requirement: Brand kit must be validated for readability
The system SHALL validate or normalize owner-provided brand settings so the dashboard remains readable and usable.

#### Scenario: Low-contrast primary color submitted
- WHEN an owner/admin saves a primary color that would make button text unreadable
- THEN the system SHALL either compute a safe text color or warn before saving
- AND the resulting dashboard SHALL remain accessible
