# Pilot Onboarding Checklist

This is the current pilot onboarding map for OpenSeat.

There are now two real paths:
- self-serve onboarding in the dashboard for a net-new restaurant
- assisted sandbox provisioning for demos, resets, and guided pilot testing

## 1. Entry point today

Current public entry points are:
- dashboard `/signup` self-serve onboarding wizard
- marketing site demo / contact CTA

Use the path that fits the moment.

### Self-serve product path
1. prospect opens the dashboard signup flow
2. owner creates the restaurant, account, hours, and initial tables
3. owner lands directly inside the new dashboard workspace

### Assisted pilot / sandbox path
1. prospect lands on marketing site or asks for a guided setup
2. operator provisions a sandbox tenant when a clean demo or reset is better than a blank production workspace
3. operator sends dashboard credentials
4. owner runs first setup + test flows

## 2. Provision sandbox tenant when you need a guided demo or reset

From repo root:

```bash
pnpm --filter @openseat/api exec node scripts/provision-pilot-sandbox.mjs \
  --source-slug=bff-raanana \
  --target-slug=bff-v2 \
  --target-name="BFF v2" \
  --admin-email="admin+bffv2@bff.co.il" \
  --admin-password="BFFv2Admin!2026" \
  --super-admin-email="milhemsione@gmail.com" \
  --super-admin-password="OpenSeatSuper!2026" \
  --reset-data
```

What this does:
- clones baseline restaurant config from `BFF Ra'anana`
- clones table layout
- keeps sandbox operational data clean
- upserts a tenant admin login
- upserts super-admin demo credentials if provided

## 3. Login options

### Platform / multi-restaurant view
- email: `milhemsione@gmail.com`
- role: `super_admin`
- use this to switch between restaurants in `/restaurants`

### Sandbox owner/admin view
- email: `admin+bffv2@bff.co.il`
- role: `admin`
- use this to see the dashboard exactly like a restaurant owner would

## 4. First-run owner test flow

After logging into the sandbox admin:
1. open Today view and confirm it is a clean workspace
2. open Settings and confirm business details / hours / tables feel editable
3. open Loyalty (`מועדון`) and confirm rewards/membership start clean
4. create the first reward and first guest-facing test loop
5. use the booking widget / reservation flow to create fresh sandbox data
6. return to dashboard and verify the data appears only inside `BFF v2`

## 5. Super-admin switching test

Use the super-admin login to verify:
1. `/restaurants` shows both `BFF Ra'anana` and `BFF v2`
2. switching into each restaurant changes dashboard context without re-login
3. `BFF Ra'anana` keeps live pilot data
4. `BFF v2` stays isolated as the sandbox tenant

## 6. What should be built next

Self-serve onboarding now exists, so the next slice is about making it deeper.

Next improvements should add:
- branding and widget setup inside onboarding
- WhatsApp connection/setup
- loyalty starter templates turned on during onboarding
- optional sample data / launch test mode so a new client can simulate the first week fast
- marketing-site CTA wiring directly into dashboard signup
