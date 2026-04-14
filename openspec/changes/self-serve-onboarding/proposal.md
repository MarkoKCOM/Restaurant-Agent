## Why

The dashboard can now switch between restaurants, but a new client still cannot create their own workspace.

That is the wrong bottleneck.
If OpenSeat wants to sell like a real product, a restaurant owner needs to be able to:
- open the dashboard
- create their restaurant account
- enter the core setup details
- land in a usable workspace without operator intervention

Right now the system still depends on manual provisioning or sandbox scripts. Good for internal ops. Bad for actual client onboarding.

## What Changes

This change adds a first real self-serve onboarding flow for restaurant owners.

It includes:
- a public signup endpoint that creates a restaurant tenant and owner admin account in one transaction
- a dashboard onboarding wizard reachable from the login page
- first-run collection of restaurant basics, operating hours, and initial table setup
- automatic login into the freshly created workspace after signup
- an updated dashboard entry point so a new client can start onboarding without contacting an operator first

## Capabilities

### New Capabilities
- `public-restaurant-signup` — create a new restaurant tenant and owner account from the dashboard without operator help
- `owner-onboarding-wizard` — guide a new owner through first-run setup for core restaurant data, hours, and tables

### Modified Capabilities
- `multi-restaurant` — newly self-served restaurants should immediately become valid tenant contexts in the platform
- `pilot-onboarding-runbook` — assisted onboarding remains a fallback, but self-serve becomes the primary happy path

## Impact

Product:
- a client can actually go to the dashboard and onboard themselves
- sales/demo friction drops because the product now proves its own setup story
- new restaurants become real tenants immediately instead of waiting for manual provisioning

Engineering:
- tenant creation logic moves into a reusable public API path instead of living only in scripts
- onboarding state becomes explicit in the dashboard flow
- verification can cover a true signup journey instead of only admin-created tenants
