## 1. Seam scaffolding (no behavior change)

- [x] 1.1 Export `DbTransaction` type from `apps/api/src/db/index.ts` (derive from Drizzle's transaction callback param)
- [x] 1.2 Create `apps/api/src/repositories/types.ts` with `export type Executor = DB | DbTransaction` and a shared `resolveExecutor(executor = db)` default helper
- [x] 1.3 Add a repository convention note (rules: data-access only, required `restaurantId` on tenant-scoped methods, executor param, no Fastify/request coupling, business logic stays in services) to CONVENTIONS.md
- [x] 1.4 Verify scaffolding builds and type-checks with no behavior change (`turbo build type-check`)

## 2. Reference migration: tables (leaf service)

- [x] 2.1 Create `apps/api/src/repositories/table.repository.ts` with `findByRestaurant`, `findById(id, restaurantId)`, `insert`, `update`, `deactivate` — all taking `executor = db`, tenant filter applied internally
- [x] 2.2 Switch `apps/api/src/services/table.service.ts` to use `tableRepository`; delete the now-dead inline `eq(tables.restaurantId, ...)` filters and the direct `db` import
- [x] 2.3 Add a Vitest unit test for `table.service.ts` using a mocked `tableRepository` (no DB connection) — wired Vitest into the API package (config + `test` script + build excludes `*.test.ts`)
- [x] 2.4 Confirm unit tests + CI-equivalent checks pass; no route response shape changed (smoke runs against the live/old service, so deferred to post-deploy — refactor is behavior-preserving)
- [x] 2.5 Open PR for the reference migration (#29); review and lock the pattern before fanning out

## 3. Migrate remaining tenant-scoped services (one PR each)

- [x] 3.1 Migrate `guest.service.ts` → `guest.repository.ts` (+ mocked-repo unit test); seeded `challenge.repository.ts` for the profile read; added a Vitest env-setup so unit tests stay DB-free
- [x] 3.2 Migrate `reservation.service.ts` → `reservation.repository.ts` (+ `restaurant.repository.ts`, guest increment helpers; 6 unit tests). Done in an isolated git worktree to avoid a concurrent agent's branch switching.
- [x] 3.3 Migrate `waitlist.service.ts` → `waitlist.repository.ts` (reuses `guestRepository`; dropped dead `resolveGuest`/`sql`; 5 unit tests)
- [x] 3.4 Migrate the visit/loyalty cluster (split into two PRs):
  - [x] 3.4a `visit.service.ts` → `visit.repository.ts` (+ `reservationRepository.findByGuest`; reuses `guestRepository`; 4 unit tests)
  - [x] 3.4b `loyalty.service.ts` → `loyalty-transaction.repository.ts` + `reward.repository.ts` (+ `guestRepository.adjustPoints`, `reservationRepository.findVisitCompletionContext`; idempotency filters preserved exactly; 6 unit tests)
- [ ] 3.5 Migrate the engagement cluster: `engagement.service.ts`, `campaign.service.ts`, `challenge.service.ts`, `achievement.service.ts`, `reward-claims.service.ts`
- [ ] 3.6 Migrate referral/leaderboard/gamification-share/feedback/outbound-message services
- [ ] 3.7 Migrate read-only/reporting services: `analytics.service.ts`, `summary.service.ts`, `diagnostics.service.ts`, `membership-intent-debug.service.ts`
- [ ] 3.8 Decide + handle non-tenant lookups (`restaurants` by slug, `adminUsers` by email) per the design's open question
- [ ] 3.9 Confirm worker/cron entry points route through services/repositories, not direct `db`

## 4. Prove transaction composability (unblocks #2)

- [ ] 4.1 Pick one multi-write service flow (e.g. visit completion touching guests + visit logs + loyalty) and wrap it in `db.transaction`, threading `tx` through repository calls
- [ ] 4.2 Add a test/smoke assertion that the multi-write flow commits atomically (and rolls back on failure)

## 5. Guardrails + close-out

- [ ] 5.1 Verify zero remaining inline `eq(table.restaurantId, ...)` filters in `apps/api/src/services/` (grep returns 0)
- [ ] 5.2 Add a CI/lint guard forbidding `import { db }` inside `apps/api/src/services/` (flip from warn → error once migration is complete)
- [ ] 5.3 Update PROGRESS.md with the data-access seam outcome and note that #2 (transactions) and #5 (centralized scoping) are now unblocked
- [ ] 5.4 Run `openspec archive data-access-seam` once all services are migrated and merged
