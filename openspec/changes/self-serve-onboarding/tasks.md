## Self-Serve Onboarding Tasks

### Spec / Planning
- [x] Add proposal for public restaurant signup and owner onboarding wizard
- [x] Add design doc for signup flow, backend transaction, defaults, and verification
- [x] Add capability specs for public signup and owner onboarding wizard

### Shared / Contracts
- [x] Add shared onboarding payload schema/types for the self-serve signup flow

### Backend
- [x] Add public signup endpoint that creates restaurant, admin, and initial tables in one transaction
- [x] Reuse login/auth response shape for signup success
- [x] Ensure generated restaurant slugs are unique

### Dashboard
- [x] Add self-serve onboarding page/wizard in the dashboard
- [x] Add login-page CTA for new restaurants
- [x] Auto-login and route into the new workspace after successful signup

### Verification
- [x] Verify API signup flow end to end
- [x] Verify live dashboard signup/login flow end to end
- [x] Verify super-admin can see the newly created tenant
- [x] Run build/type-check/test commands for changed packages

### Delivery
- [x] Update `PROGRESS.md`
- [ ] Commit and push to `main`
