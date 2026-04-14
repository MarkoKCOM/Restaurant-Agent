## Overview

This tranche is about making pilot operations testable right now.

We already have super-admin auth and a restaurant picker in the dashboard. The missing pieces are:
- a second tenant worth switching to
- a predictable way to provision that tenant
- a documented onboarding path for a new owner while self-serve signup does not yet exist

## Sandbox Provisioning Design

### Provisioning model
A sandbox tenant should be created by cloning baseline restaurant configuration from an existing source tenant while keeping operational data clean.

For `BFF v2`, the provisioner should:
- clone the source restaurant's structural setup:
  - package
  - locale/timezone
  - operating hours
  - widget/dashboard/agent config
  - table layout
- override sandbox identity fields:
  - name
  - slug
  - description / welcome copy where useful
- avoid copying live operational data:
  - guests
  - reservations
  - waitlist
  - conversations
  - loyalty transactions
  - rewards / reward claims
  - campaigns / engagement jobs / challenge progress / visit logs

That gives us a restaurant that feels configured but still behaves like a fresh customer account.

### Script behavior
The provisioner should be idempotent enough for pilot use:
- create the target tenant if missing
- upsert the target admin login
- optionally reset sandbox operational data if rerun
- preserve super-admin access while allowing password reset when needed for live demo use

A script is the right move here because current OpenSeat does not expose a productized `POST /restaurants` onboarding flow.

## Access Model

### Super-admin flow
No new product code is required for switching itself.

Existing flow:
- super-admin logs in
- dashboard opens the restaurant picker
- active restaurant is stored client-side
- subsequent API requests use the chosen restaurant context

The important pilot change is operational, not architectural:
- there must be at least two real tenants in the database
- at least one of them should be clean enough to act like a fresh client workspace

### Tenant admin flow
The sandbox also needs a dedicated restaurant admin so Sione can compare:
- what a platform operator sees (`super_admin`)
- what a normal restaurant owner sees (`admin`)

## Pilot Onboarding Design

### Current reality
The marketing site currently provides awareness/demo/contact entry points, not a real self-serve tenant-creation wizard.

So the current onboarding flow should be documented as assisted onboarding:
1. prospect lands on marketing site
2. prospect clicks demo/contact CTA
3. operator provisions sandbox tenant
4. operator hands over admin login
5. owner completes basic setup and runs first booking/dashboard tests

### Why document the assisted flow
This keeps the pilot honest.
We can test the full customer journey without lying to ourselves that self-serve signup exists already.

It also sharpens the next product slice: eventually replace the provisioning step with a true onboarding wizard and restaurant creation endpoint.

## Verification

Minimum verification for this tranche:
- provision `BFF v2`
- verify super-admin login works
- verify `/restaurants` shows both `BFF Ra'anana` and `BFF v2`
- verify switching into `BFF v2` loads dashboard pages without tenant leakage
- verify sandbox admin login works
- verify marketing site entry still leads only to demo/contact, confirming self-serve onboarding is still a product gap
