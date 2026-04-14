## Loyalty Referral Visibility Tasks

### Spec / Planning
- [x] Add proposal for stronger loyalty/referral visibility, general membership docs, and backend coverage
- [x] Add design doc for dashboard, docs, guest payload exposure, and test strategy
- [x] Add capability specs for owner membership ops, agent tooling, and operator guidance

### Dashboard
- [x] Make referrals first-class in the loyalty dashboard instead of only implied through rewards
- [x] Surface referral advocates, referred guests, and referral-ready reward context on `/loyalty`

### Shared / Backend Contracts
- [x] Expose guest referral attribution cleanly in shared/domain + API guest payloads for dashboard use

### Documentation
- [x] Add a general membership FAQ not tied to one restaurant brand
- [x] Add a general membership operations guide for operators/admins
- [x] Update `docs/OWNER-GUIDE.md` to point at the new membership docs

### Coverage
- [x] Strengthen `apps/e2e` coverage for reward metadata round-trip
- [x] Strengthen `apps/e2e` coverage for messaging preference persistence
- [x] Strengthen `apps/e2e` coverage for referral persistence and summary assertions

### Verification
- [x] `pnpm --filter @openseat/domain build`
- [x] `pnpm --filter @openseat/api build`
- [x] `pnpm --filter @openseat/dashboard build`
- [x] `pnpm --filter @openseat/e2e type-check`
- [ ] Optional safe-target runtime validation with `pnpm --filter @openseat/e2e test` and `pnpm --filter @openseat/e2e test:extended`

### Delivery
- [x] Update `PROGRESS.md`
- [ ] Commit and push to `main` (intentionally not done in this task)
