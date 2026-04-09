## ADDED Requirements

### Requirement: Brand editing in restaurant settings
The dashboard SHALL provide a settings experience where restaurant admins can manage white-label branding for their own dashboard.

#### Scenario: Admin edits branding
- WHEN a restaurant admin opens dashboard settings
- THEN they SHALL be able to edit the restaurant's dashboard branding fields
- AND saving SHALL persist the configuration through the restaurant update flow

#### Scenario: Employee access to settings
- WHEN an employee logs into the dashboard
- THEN they SHALL not be able to access branding settings
- AND they SHALL not be able to modify restaurant branding

### Requirement: Branding preview before save
The brand settings editor SHALL provide enough preview context for an owner/admin to understand how the dashboard will look before committing changes.

#### Scenario: Admin previews a sidebar palette
- WHEN the admin changes primary/sidebar colors or logo assets
- THEN the settings page SHALL show a preview of the branded header/sidebar treatment before save

### Requirement: Safe reset to defaults
The dashboard SHALL support resetting restaurant branding back to platform defaults.

#### Scenario: Admin resets theme
- WHEN an admin chooses reset to defaults
- THEN the restaurant's custom branding fields SHALL be cleared or replaced with defaults
- AND the dashboard SHALL return to the default OpenSeat theme for that restaurant
