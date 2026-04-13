## Why

BFF now has a dedicated loyalty dashboard and a reward-template library in the UI, but the important part is still missing: reward templates are not first-class data.

Today the template guidance lives only in dashboard copy and docs:
- the owner can see suggested offers
- the bot persona doc explains how Jake should talk
- but the actual reward records in the API/database do not store template metadata, recommended guest moments, or example pitch copy

That creates a dumb gap:
- owners can create a reward from a template, but the system forgets why that reward exists
- the membership summary can show price/claimability, but not when the reward should be offered
- the WhatsApp agent cannot reliably know which configured reward fits a birthday, comeback, referral, or host-perk moment

## What Changes

This change makes loyalty reward templates part of the actual product model.

It adds:
- structured template metadata on rewards
- a shared reward-template catalog for dashboard use
- owner-facing dashboard surfaces that preserve template guidance on saved rewards
- agent-facing membership summary fields so Jake can choose the right live reward and phrase it naturally

## Capabilities

### New Capabilities
- `reward-template-catalog` — structured reward-template metadata and dashboard creation flows
- `member-reward-guidance` — agent-facing reward guidance inside membership summaries

### Modified Capabilities
- `owner-membership-ops` — owners/admins can create rewards with durable template guidance, not just raw points + name
- `membership-agent-tooling` — membership summary exposes which live rewards fit which guest moments and how to pitch them

## Impact

Product:
- loyalty becomes visible and understandable inside the dashboard
- owners get clearer guidance on what to offer and why
- Jake can recommend the right configured reward instead of guessing

Engineering:
- DB migration for reward metadata
- shared domain types/template catalog
- loyalty API create/update/list changes
- membership summary response expansion
- dashboard reward creation/list rendering changes
