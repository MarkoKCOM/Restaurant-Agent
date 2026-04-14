## Why

The next pilot bottleneck is not loyalty anymore. It is proving that OpenSeat can feel like a real multi-restaurant product during sales and onboarding.

Right now we have:
- a working super-admin dashboard switcher
- one real pilot tenant (`BFF Ra'anana`)
- no clean second tenant to switch into
- no proper zero-to-onboarding product flow for a new restaurant owner

That means Sione cannot yet do the two most important pilot demos cleanly:
- move between restaurant dashboards like a platform operator
- act like a brand-new client and go from first touch to usable dashboard

## What Changes

This change creates a pilot-safe sandbox path instead of pretending self-serve onboarding already exists.

It adds:
- a reusable sandbox provisioning script that creates a clean tenant from an existing pilot baseline
- a `BFF v2` sandbox tenant for testing dashboard switching and first-run setup
- documented pilot onboarding steps for the current assisted flow
- explicit OpenSpec coverage for the current gap: marketing/demo entry exists, but restaurant self-serve creation is not productized yet

## Capabilities

### New Capabilities
- `pilot-sandbox-provisioning` — provision a clean sandbox tenant with usable dashboard access and baseline restaurant config
- `pilot-onboarding-runbook` — define the current zero-to-onboarding pilot path, even before a real self-serve wizard exists

### Modified Capabilities
- `multi-restaurant` — super-admin switching should be exercised against at least one clean sandbox tenant, not only a single live pilot restaurant

## Impact

Product:
- Sione can test cross-restaurant dashboard switching with real data separation
- BFF gets a safe sandbox for admin UX testing without polluting the live pilot tenant
- the onboarding story becomes honest: assisted today, self-serve later

Engineering:
- tenant provisioning becomes repeatable instead of manual DB poking
- future onboarding work has a clean spec handoff instead of vague "we should build signup someday"
- pilot verification gets a reusable script + checklist instead of tribal knowledge
