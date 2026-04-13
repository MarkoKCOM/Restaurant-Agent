## 1. Product model and package boundaries
- [x] 1.1 Define the member-facing membership summary model from existing guest/loyalty/challenge data
- [x] 1.2 Define Growth-package gating for membership club capabilities and upgrade behavior
- [x] 1.3 Align product copy around "membership club" / חבר מועדון rather than generic gamification terminology

## 2. Agent/API tooling for WhatsApp membership flows
- [x] 2.1 Add or normalize endpoints/tools for membership summary retrieval
- [x] 2.2 Add reward discovery and claim flow suitable for WhatsApp conversations
- [ ] 2.3 Add referral retrieval/share flow suitable for WhatsApp conversations
- [x] 2.4 Add staff reward-verification/redemption flow
- [x] 2.5 Add opt-in/opt-out handling for non-transactional membership messaging

## 3. Lifecycle wiring
- [x] 3.1 Audit reservation completion hook chain end-to-end
- [x] 3.2 Ensure completion triggers points, stamps, tier evaluation, streak update, and eligible challenge progress consistently
- [ ] 3.3 Add repair/retry visibility for post-visit membership processing failures

## 4. Owner/staff product surfaces
- [x] 4.1 Add owner/admin reward and club management surfaces
- [x] 4.1a Add reward-template guidance so owners know what kind of offers to create and when to use them
- [x] 4.2 Surface member signals and active claims in reservation/guest operational views
- [x] 4.3 Allow employee role to verify/honor rewards without owner-level access
- [x] 4.4 Surface special-attention guest signals (birthday, celebration, VIP, regular, owner friend, house-comp)
- [ ] 4.5 Let owners/staff record hospitality context that should appear on future arrivals

## 5. WhatsApp journeys and automation
- [x] 5.1 Define guest WhatsApp flows for balance, tier, rewards, referrals, and club questions
- [x] 5.2 Reframe automated loyalty/retention messages as membership-club interactions
- [ ] 5.3 Enforce pacing, opt-out handling, and transactional-vs-promotional separation
- [x] 5.4 Ensure Hebrew-first copy quality with English fallback

## 6. Verification
- [x] 6.1 Add API tests for membership summary, reward claims, referrals, and redemption workflow
- [x] 6.2 Add integration tests for visit completion → membership updates
- [ ] 6.3 Add conversational tests for WhatsApp membership intents
- [ ] 6.4 Validate owner/admin vs employee access boundaries for membership operations
