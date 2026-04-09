## Context

Current platform state:
- Loyalty foundation exists in backend: points, tiers, stamp card, reward catalog, referrals, challenges, streak service, engagement jobs
- Some loyalty information is visible in the dashboard guest detail page
- Reservation completion already triggers visit-count and points logic
- But the product is not yet organized as a WhatsApp-first member experience

Current issues:
1. The guest experience is fragmented and mostly implicit.
2. Dashboard visibility exists, but WhatsApp-native club flows are not fully defined.
3. Some gamification logic is not fully wired into the visit lifecycle.
4. Engagement delivery is not yet the same thing as a coherent member journey.
5. Owner/staff workflows for redeeming or honoring club benefits are not clearly productized.

## Product Principle

The dashboard is for configuration and operations.
WhatsApp is for guest experience.

That means every meaningful membership feature should answer two questions:
1. What does the owner configure or monitor in the dashboard?
2. What is the exact guest flow in WhatsApp?

If a feature only exists in the dashboard and has no guest journey, it is not really part of the membership club yet.

## Proposed Membership Model

A restaurant membership club is the Growth package layer built around:
- member identity
- earning logic
- progression logic
- reward catalog
- automated lifecycle messaging
- conversational self-service in WhatsApp

Conceptually:

```ts
interface MembershipProfile {
  guestId: string;
  restaurantId: string;
  status: "active" | "paused" | "opted_out";
  tier: "bronze" | "silver" | "gold";
  pointsBalance: number;
  stampProgress: {
    current: number;
    target: number;
  };
  nextTier?: {
    tier: "silver" | "gold";
    visitsRemaining?: number;
    pointsRemaining?: number;
  };
  activeRewards: Array<...>;
  referralCode?: string;
  activeChallenges: Array<...>;
  streak?: {
    current: number;
    best: number;
  };
}
```

This profile does not necessarily require a new table immediately; it can be composed from existing guest + loyalty + challenge data. But the product should behave as if this is one coherent member profile.

## WhatsApp-First Journey Set

### 1. Join / Welcome
Trigger options:
- after first completed visit
- after first reservation creation
- explicit opt-in via message or link

Guest sees:
- welcome to the restaurant club
- what they get
- current starting status
- how to check balance / rewards

### 2. Balance / Status
Guest can ask naturally:
- how many points do I have?
- what rewards do I have?
- what is my tier?
- how many visits until silver?

System should answer with:
- points balance
- current tier and perk framing
- next milestone
- stamp card progress
- optionally top available reward

### 3. Reward Discovery + Claim
Guest asks:
- what can I redeem?
- use my points
- do I have a reward?

System should:
- list rewards relevant to their balance
- explain cost and value simply
- generate a redemption code or claim token
- notify staff/dashboard that the reward was claimed/pending redemption

### 4. Referral
Guest asks:
- send me my referral code
- invite a friend

System should:
- generate/retrieve referral code
- explain what both sides get
- confirm after a referred guest qualifies

### 5. Challenge / Streak / Re-engagement
System should proactively message when:
- streak milestone reached
- tier upgraded
- stamp card nearly full
- challenge completed
- birthday / comeback / we-miss-you moments occur

These should feel like club moments, not generic notifications.

## Owner + Staff Model

Owner/admin needs:
- configure reward catalog
- define membership copy/perks
- see who redeemed what
- see member growth and retention signals
- create seasonal challenges
- know when a birthday guest, anniversary table, or celebration booking is coming in
- know when a guest is a long-term regular, owner friend, VIP, or house-comp guest
- make sure those relationship-based guests get special attention at service time

Employee/staff needs:
- view member status on reservation/guest record
- see whether guest has active reward or VIP tier
- honor redemption code
- mark reward as redeemed / consumed
- see birthday / celebration / special-attention signals before service
- understand why a guest needs special attention, not just that they have points
- not access owner-level strategy/configuration screens

## Tooling / API Preparation

WhatsApp-first product quality depends on agent tools being explicit, not improvised.

Needed tool/endpoint categories:
- get membership summary for guest by phone/guestId
- get claimable rewards
- generate or fetch referral code
- redeem reward / create claim code
- mark claim as redeemed by staff
- list active challenges and progress
- fetch next milestone explanation
- opt in / opt out of club messaging

The customer agent should not reconstruct these by manually piecing together raw records every time.

## Package Gating

Starter:
- reservations
- waitlist
- basic guest profile

Growth:
- membership club
- points/tier/stamps/rewards
- referrals/challenges/streaks
- automated re-engagement
- WhatsApp member journeys

This separation matters both technically and commercially.

## Lifecycle Wiring Requirements

A completed visit should become the central event that can trigger:
- visit count increment
- points award
- stamp progress update
- tier evaluation
- streak update
- eligible challenge progress
- thank-you / review / comeback scheduling
- member-facing WhatsApp response copy if relevant

The system should avoid partial success where points update but streak/challenge/member messaging does not.

## Risks

1. Club feels confusing if guests see too many mechanics at once.
2. WhatsApp messaging can feel spammy without pacing and opt-out controls.
3. Staff adoption fails if redemption is unclear at service time.
4. Product can overpromise if backend automation is only partially wired.

## Mitigations

- Start with a tight v1 member vocabulary: points, status, rewards, club benefits.
- Keep advanced gamification under the hood until it is clearly valuable.
- Give staff a simple “has reward / redeemed / VIP” operational view.
- Define deterministic tool flows before exposing new agent promises to guests.
