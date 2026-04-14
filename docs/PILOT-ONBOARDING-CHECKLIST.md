# Pilot Onboarding Checklist

This is the current zero-to-onboarding path for OpenSeat pilots.

It is not fully self-serve yet.
The first step is still assisted by an operator.
That is fine for the pilot — just be honest about it.

## 1. Entry point today

Current public entry is:
- marketing site demo / contact CTA

Current gap:
- there is no self-serve restaurant signup + tenant creation wizard yet
- there is no public `create restaurant` product flow yet

So the real pilot flow today is:
1. prospect lands on marketing site
2. prospect asks for a demo / contact
3. operator provisions a sandbox tenant
4. operator sends dashboard credentials
5. owner runs first setup + test flows

## 2. Provision sandbox tenant

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

This checklist is the interim bridge, not the end state.

The next real onboarding slice should add:
- restaurant signup / creation endpoint
- first-run onboarding wizard
- owner account creation inside the product
- setup steps for hours, tables, branding, widget, and WhatsApp
- "launch test mode" so a new client can simulate the first week without manual operator provisioning
