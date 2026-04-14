## Why

OpenSeat already has a dedicated loyalty dashboard, reward-template metadata, and member summaries, but the next product gap is obvious:

- referrals are still too hidden in the dashboard experience
- membership docs are mostly BFF-specific or too thin for general rollout
- backend coverage is not asserting enough of the loyalty metadata, referral attribution, or messaging-preference behavior we now depend on

That creates a product mismatch:
- owners can technically run a referral loop, but the dashboard does not make it feel first-class
- operators do not yet have a reusable general membership FAQ/playbook
- backend regressions could silently strip metadata or referral state without strong automated coverage

## What Changes

This change makes the loyalty surface feel more complete and operationally useful.

It adds:
- a stronger referral-first dashboard view inside the loyalty page
- general OpenSeat membership documentation for operators and member-facing answers
- stronger end-to-end backend/API assertions for reward metadata, referral state, and messaging preferences
- clean dashboard exposure of referral attribution on guest rows where needed

## Capabilities

### New Capabilities
- `membership-operator-guidance` — reusable membership FAQ and operator usage guidance that is not tied to one restaurant brand

### Modified Capabilities
- `owner-membership-ops` — loyalty dashboard makes bring-a-friend/referrals visible as a first-class operating surface
- `membership-agent-tooling` — normalized membership/member data remains trustworthy for reward metadata, referrals, and messaging state

## Impact

Product:
- referrals become clearly visible in the dashboard instead of feeling buried
- operators get reusable docs they can actually use across restaurants
- loyalty feels like a real retention workspace, not a thin wrapper around reward CRUD

Engineering:
- guest API/domain payloads expose referral attribution cleanly for dashboard use
- e2e/API coverage grows around reward metadata round-trip, referral assertions, and messaging-preference persistence
- docs and progress log stay aligned with the shipped tranche
