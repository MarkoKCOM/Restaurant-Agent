## ADDED Requirements

### Requirement: Tenant isolation
Each restaurant SHALL have a fully isolated data environment: separate guest database, reservation book, loyalty program, campaigns, and analytics. No data SHALL leak between tenants.

#### Scenario: Two restaurants on the platform
- **WHEN** Restaurant A and Restaurant B are both on Sable
- **THEN** Restaurant A's owner SHALL NOT see any of Restaurant B's guests, reservations, or analytics, and vice versa

### Requirement: Per-restaurant agent instance
Each restaurant SHALL get its own agent instance with its own knowledge base, personality, WhatsApp number, and configuration. Agent behavior SHALL be fully independent per restaurant.

#### Scenario: Different agent personalities
- **WHEN** Restaurant A configures a casual tone and Restaurant B configures formal tone
- **THEN** each agent SHALL respond in its own configured style

### Requirement: Package enforcement
The system SHALL enforce package-level feature access. Starter restaurants SHALL NOT have access to Growth features (CRM details, loyalty, campaigns, gamification, analytics dashboard).

#### Scenario: Starter restaurant tries to access loyalty
- **WHEN** a Starter-package restaurant owner attempts to configure a loyalty program
- **THEN** the system SHALL show an upgrade prompt explaining the Growth package benefits

### Requirement: Central management console
The platform SHALL provide a central admin console for managing all restaurant tenants: onboarding, package management, billing, support, and system health monitoring.

#### Scenario: Admin views all restaurants
- **WHEN** a platform admin logs into the management console
- **THEN** they SHALL see all restaurant tenants with their package, status, usage stats, and billing info

### Requirement: Subscription and billing
The system SHALL manage monthly subscriptions per restaurant. Billing SHALL support Israeli payment methods (credit card via PayPlus/Meshulam) and international (Stripe). Package changes SHALL take effect at the next billing cycle.

#### Scenario: Restaurant upgrades from Starter to Growth
- **WHEN** a Starter restaurant owner upgrades to Growth mid-cycle
- **THEN** the system SHALL prorate the remainder of the month and activate Growth features immediately
