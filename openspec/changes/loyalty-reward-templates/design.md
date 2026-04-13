## Overview

The fix is to stop treating reward templates as presentation-only dashboard cards.

Reward templates need two layers:
1. a shared catalog of default BFF/OpenSeat reward-template definitions used by the dashboard
2. durable reward-level metadata stored with each created reward so downstream systems can understand why the reward exists and how Jake should talk about it

## Data Model

Add reward metadata fields on `rewards`:
- `templateKey` — optional stable template identifier (for example `dessert-next-visit`, `midweek-discount`, `host-perk`)
- `recommendedMoments` — optional array of moment tags like `birthday`, `comeback`, `referral`, `milestone`, `group`
- `pitchHe` — optional guest-facing example pitch in Hebrew
- `pitchEn` — optional guest-facing example pitch in English

These fields are optional so custom rewards continue to work.

## Shared Template Catalog

Create a shared domain export for the default BFF reward-template library.

Why shared:
- dashboard should not hardcode the templates in a page component
- template keys and moment tags should stay consistent between dashboard and API payloads
- future channels can reuse the same canonical catalog

The catalog should include:
- template key
- localized title
- localized moment description
- localized offer description
- localized rationale
- localized example pitch
- default reward fields (`nameHe`, `nameEn`, `descriptionHe`, `descriptionEn`, `pointsCost`)
- normalized `recommendedMoments`

## API Changes

### Reward create/update/list
Extend reward create/update schemas and service methods to accept and return:
- `templateKey`
- `recommendedMoments`
- `pitchHe`
- `pitchEn`

`listRewards()` should return the new fields directly from the rewards table.

### Membership summary
Expand `rewards.available[]` in `membership-summary.service.ts` to include the same metadata.

That gives Jake enough structured context to answer:
- what should I offer this guest?
- what should I say?

The summary remains normalized and avoids circular dependencies.

## Dashboard Changes

### Reward template cards
Replace component-local template constants with the shared domain catalog.

### Reward creation form
When an owner clicks a template:
- prefill name/description/points as today
- also prefill hidden/stored metadata (`templateKey`, `recommendedMoments`, `pitchHe`, `pitchEn`)

Manual reward creation should still be allowed. If the owner does not use a template, metadata can stay empty.

### Saved reward visibility
In active/inactive reward lists, show enough context so the owner can understand what the reward is for:
- template badge or moment tags when present
- example pitch when present

That makes loyalty strategy visible inside the dashboard instead of disappearing after save.

## Type/Contract Changes

Update shared/domain and dashboard types so reward metadata is typed end-to-end.

Likely touchpoints:
- `packages/domain/src/types.ts`
- `packages/domain/src/index.ts` or a new template export file
- `apps/dashboard/src/hooks/api.ts`

## Backward Compatibility

- Existing rewards remain valid with null metadata.
- Dashboard template cards continue to work, now with durable persistence.
- Agent flows should prefer live rewards with metadata when present, but still function for legacy rewards without it.

## Verification

Run at minimum:
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`

Manual checks:
- create a reward from a template
- confirm template metadata persists through list API
- confirm membership summary includes reward guidance fields
- confirm loyalty dashboard shows saved reward context, not just name + points
