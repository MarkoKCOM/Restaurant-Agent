## Why

Most real guest interaction will happen in WhatsApp, not in the dashboard.

That changes how OpenSeat should think about loyalty and retention. A restaurant owner may manage settings from a dashboard, but the guest should experience the product as a living membership club inside WhatsApp:
- join the club
- check points and tier
- see progress to next reward
- claim a reward
- get reminder/re-engagement messages
- receive birthday / comeback / referral flows
- talk naturally with the restaurant assistant

Today OpenSeat has useful loyalty primitives (points, tiers, stamp card, rewards, referrals, challenges, engagement jobs), but they are not yet shaped into a clear WhatsApp-first membership product.

To make this a real Growth-package sales point, OpenSeat needs to turn those primitives into a coherent “restaurant membership club” experience — effectively a digital חבר מועדון that feels native to WhatsApp.

## What Changes

This change defines a WhatsApp-first membership club for restaurants.

It introduces:
- a member-facing club model and conversational flows for WhatsApp
- owner/staff operational flows for managing rewards and redemption
- agent/API tooling specifically prepared for WhatsApp-based membership interactions
- clearer package boundaries so membership is positioned as a Growth feature

## Capabilities

New capabilities:
- `membership-club-core` — define what a restaurant membership club is in OpenSeat
- `whatsapp-member-journeys` — guest-facing WhatsApp flows for membership operations
- `owner-membership-ops` — owner/staff dashboard + floor workflows for club management and redemption
- `membership-agent-tooling` — API/agent tools needed to execute membership flows reliably through WhatsApp

Modified capabilities:
- `loyalty-engine` — move from raw counters toward member-facing club concepts
- `gamification` — connect streaks/challenges/referrals to real guest journeys
- `engagement-automation` — make automation part of membership, not just standalone messaging
- `whatsapp-gateway` — ensure inbound/outbound WhatsApp can support membership flows, not only reservations

## Impact

Product:
- Growth package becomes much easier to explain and sell.
- Restaurants can market a free club/membership, not just “we have points”.
- Guests interact with the club where they already are: WhatsApp.

Engineering:
- Requires explicit conversational intents and tool support for loyalty actions.
- Requires end-to-end wiring from reservation completion to points/tier/streak/challenge/referral outcomes.
- Requires owner/staff redemption and exception-handling flows.

Go-to-market:
- The sales message becomes: “free restaurant membership club on WhatsApp” with retention automation built in.
