## Overview

This tranche is about making loyalty operations visibly useful, not just technically present.

The system already stores the right building blocks:
- reward template metadata
- referral codes and referral attribution
- messaging preference state
- normalized membership summaries

The missing pieces are visibility, documentation, and stronger regression protection.

## Dashboard Design

### Loyalty page
The loyalty page should stop looking like a thin stats page plus reward manager.

It should explicitly surface bring-a-friend as one of the main program loops.

Planned dashboard additions:
- referral spotlight card near the top of the page
- summary counts for guests with referral codes, guests acquired through referrals, and referral-ready rewards
- an operator-facing list of top referral advocates
- an operator-facing list of referred guests and who brought them in
- referral-ready rewards shown as part of the referral story, not just as generic rewards

This keeps referrals visible without creating a separate page.

### Guest payload exposure
The loyalty page needs lightweight referral attribution without N+1 summary fetching.

Expose these fields in the normal guest payload:
- `referralCode`
- `referredBy`

That keeps the dashboard logic simple and allows guest-level linking without inventing a new restaurant-level referral endpoint.

## Documentation Design

Two general docs are needed:

1. `docs/MEMBERSHIP-FAQ.md`
   - reusable answers for members and support responses
   - not tied to BFF or one restaurant voice
   - covers points, rewards, claims, referrals, and message preferences

2. `docs/MEMBERSHIP-OPERATIONS-GUIDE.md`
   - operator/admin playbook for running loyalty day to day
   - explains referral visibility, reward strategy, redemption workflow, and consent handling

`docs/OWNER-GUIDE.md` should point operators to these docs so they are discoverable from the main guide.

## Backend / Contract Coverage

### Reward metadata
The API coverage should assert that reward metadata survives:
- create reward
- update reward
- list rewards / response payloads
- membership summary reward availability payloads

The important fields are:
- `templateKey`
- `recommendedMoments`
- `pitchHe`
- `pitchEn`

### Messaging preferences
Coverage should assert that updating promotional/club opt-out state is reflected in:
- the mutation response
- guest payloads
- membership summary payloads

### Referrals
Coverage should assert that:
- generated referral codes persist on the guest record
- applying a referral sets `referredBy` on the referred guest
- referral stats reflect the awarded referral count/points
- membership summaries expose the right referral code, referred-by ID, and referral totals

## Verification

Run at minimum:
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm --filter @openseat/e2e type-check`

Recommended runtime validation when a safe API target is available:
- `pnpm --filter @openseat/e2e test`
- `pnpm --filter @openseat/e2e test:extended`
