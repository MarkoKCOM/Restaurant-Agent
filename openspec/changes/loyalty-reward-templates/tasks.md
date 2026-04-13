## Loyalty Reward Templates Tasks

### Spec / Planning
- [x] Add proposal for first-class loyalty reward templates
- [x] Add design doc for reward metadata, dashboard surfaces, and agent guidance
- [x] Add capability specs for reward-template catalog and member reward guidance

### Backend
- [x] Add DB migration for reward template metadata fields
- [x] Extend reward schema/service create/update/list paths with template metadata
- [x] Extend membership summary reward payload with template metadata

### Shared Domain
- [x] Add shared reward-template catalog/types export
- [x] Extend reward and membership summary types with template metadata

### Frontend
- [x] Move dashboard template library to the shared catalog
- [x] Persist template metadata when creating a reward from a template
- [x] Show saved reward guidance context in loyalty dashboard lists

### Verification
- [x] `pnpm --filter @openseat/domain build`
- [x] `pnpm --filter @openseat/api build`
- [x] `pnpm --filter @openseat/dashboard build`
- [x] Manual smoke test of reward template creation and loyalty dashboard visibility
- [x] Manual smoke test of membership summary reward guidance payload

### Delivery
- [x] Update `PROGRESS.md`
- [ ] Commit and push to `main`
