# Progress Log

## 2026-06-17 (Centralized tenant scoping — Phases 1a/1b/2a)

OpenSpec change `centralized-tenant-scoping`: make cross-tenant access impossible by construction (app layer) then by the DB (RLS). Shipped as three stacked PRs.

### Shipped
- **PR #57 — Phase 1a (tenant context)**: `apps/api/src/context/tenant-context.ts` (`AsyncLocalStorage`: `runWithTenant`/`enterTenant`/`getTenantRestaurantId`, explicit super_admin/system `bypass`). Entered in the auth `onRequest` hook, all 4 BullMQ workers (`runJobWithTenant`), and the seed. Pure addition (set-but-unused).
- **PR #58 — Phase 1b (scoped by-PK repos)**: `repositories/tenant-scope.ts` `tenantScope(column)`; `findById` scoped on guest/reservation/reward(+`findByIds`)/reward-claim/waitlist/challenge and `updateById` on campaign/guest/engagement-job/reservation/reward-claim/visit/waitlist — a by-id read/write for another tenant returns null/no-match. Sanctioned cross-tenant paths stay distinctly named; super_admin crosses via bypass. +5 unit tests. Route `enforceTenant` retained as defense-in-depth (raw-fetch cleanup deferred).
- **PR #59 — Phase 2a (RLS, verify mode)**: `drizzle/0014_tenant_rls.sql` enables RLS + `tenant_isolation` policy (USING+WITH CHECK) on the 14 tenant tables + `challenge_progress` (subquery via `challenges`); `restaurants`/`admin_users` exempt. **Verify mode**: not FORCEd, so the owner connection is unaffected (zero behavior change). Bypass = nil-UUID sentinel (`BYPASS_RESTAURANT_ID`). Seam helpers in `src/db/tenant-rls.ts` (`setTenantGuc`/`runInTenantTransaction`). New `pnpm db:rls-proof` transactionally FORCEs RLS and proves isolation (0 leak, bypass/deny/WITH-CHECK), 6/6.

### Decision (2026-06-17)
- **Phase 2b (fail-closed RLS) descoped.** Phase 1 already makes cross-tenant access impossible by construction for admin/employee; RLS stays in verify mode as a dormant, proven backstop. Forcing it would re-plumb every request into a per-request transaction, give public routes a tenant context (or they fail-closed), and add latency on the single-pilot VPS — a second lock on an already-locked door. Revisit when raw-SQL paths or many tenants justify it. `pnpm db:rls-proof` already proves the policies isolate once FORCEd.
- **PR #61 — close-out**: scope `reward.findActiveById` (last by-PK read relying on caller-side checks); grep audit; descope docs (tasks/ROADMAP).

### Next (optional, deferred)
- Phase 2b if/when warranted: `FORCE` + `runInTenantTransaction` wiring + cross-tenant e2e + pool-isolation test.
- Phase 1b follow-up: incrementally drop the now-redundant route raw fetch-then-check per-table.
- Archive the OpenSpec change once #57/#58/#59 merge.

## 2026-06-16 (Marketing: configurable origin + auto freshness)

### Shipped
- **PR (origin env)** `feat(marketing): configurable SITE_ORIGIN + build-time freshness` — domain-swap groundwork after the GEO work merged (#32, #44).
  - `scripts/prerender.mjs` now rewrites every hard-coded `marketing-site-nine-chi.vercel.app` (canonical, og, hreflang, schema, sitemap, robots) to `process.env.SITE_ORIGIN` (defaults to the current vercel URL). **Moving to a real domain = set `SITE_ORIGIN` on the Vercel project + redeploy, no code change.** Verified with `SITE_ORIGIN=https://openseat.co`: zero leftover vercel.app refs.
  - `WebPage.dateModified` and sitemap `<lastmod>` are stamped to the build date automatically (freshness signal never goes stale).
- **Human to-do (handed off):** register/point the real domain → set `SITE_ORIGIN`; submit sitemap to Google Search Console + Bing Webmaster; optional GEO citation monitoring once on the branded domain.

## 2026-06-16 (Marketing per-language prerendering + GEO strategy audit)

### Shipped
- **PR #44** `feat(marketing): per-language prerendering (/, /en, /ar) + coherent hreflang` — stacked on #32. Implements caveat #1 (full multilingual static coverage) and fixes a real SEO bug found while pressure-testing the GEO strategy.

### GEO strategy audit (asked to be "factually 100% confident")
- Fact-checked the load-bearing assumptions: **AI crawlers do not execute JavaScript** (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot; only Gemini renders via Googlebot) — so prerendering is required, not optional. **Google ignores hreflang when the canonical is not self-referencing** — so the old `?lang=` setup (canonical → `/`) had its hreflang silently discarded and served Hebrew at every URL to non-JS crawlers.
- Fix: per-language prerendering. `scripts/prerender.mjs` emits `dist/index.html` (he), `dist/en/index.html` (en), `dist/ar/index.html` (ar), each with localized `<html lang/dir>`, title, description, OG, `WebPage` inLanguage, and a self-referencing canonical. hreflang path-based + reciprocal; sitemap lists all three. `LandingPage` takes `initialLang` from the path; switcher uses pushState; legacy `?lang=` redirects.
- `vercel.json`: `cleanUrls` + `trailingSlash:false`. Verified the routing via a local `vercel build` (authoritative output: `en/index.html`,`ar/index.html` emitted; `/en`,`/ar` served; `/en/`→308). Playwright hydration on all 3 routes = zero errors.
- Caught a React #418 that was a `vite preview` SPA-fallback artifact (serves root `index.html` for `/en`), not a real bug — Vercel's output doesn't do this. Residual caveat: live preview curl blocked by Vercel Deployment Protection (401); confirmed via build output + faithful local sim instead.

## 2026-06-16 (Marketing spacing + SEO/GEO polish)

### Shipped
- **PR #32** `feat(marketing): tighten section spacing + SEO/GEO improvements` — follow-up to the brand bundle (#28).
  - **Spacing:** replaced fixed `120px`/`80px` section padding with responsive `clamp()` (max ~92px desktop, ~56px mobile); scaled hero padding, stats gap, and header margins too.
  - **Mobile:** verified every grid already collapses via per-section `!important` media queries; checked visually with Playwright at 390px/1280px in RTL (he) and LTR (en).
  - **Functional:** Playwright load = zero console errors; HE→EN language switch flips `dir`/`lang` and copy; all assets serve 200; build/type-check/lint pass.
  - **SEO/GEO (round 1):** the site is a client-rendered SPA (JS-less crawlers/AI saw an empty body). Added a `<noscript>` content fallback, an Organization entity, enriched SoftwareApplication schema (`featureList`/`image`/`offerCount`), "What is OpenSeat?"/"How much does it cost?" FAQ entries, and explicit robots.txt allows for GPTBot/PerplexityBot/ClaudeBot/Google-Extended/etc.
  - **SEO/GEO (round 2 — prerendering):** added build-time static prerendering (SSG). `entry-server.tsx` renders the app via `renderToString`; build runs `vite build` + `vite build --ssr` + `scripts/prerender.mjs`, which injects the rendered HTML into `dist/index.html`'s `#root`. `main.tsx` hydrates when markup is present, else client-renders (dev). Made the app hydration-safe (read `?lang` in an effect; compute the demo `today` date client-side). The full Hebrew (canonical) page is now in the raw HTML; English `<noscript>` + English schema cover English AI queries. Added WebSite, WebPage (datePublished/dateModified), HowTo (4-step loop), and Product (₪299/₪499/₪799) schema. Verified zero hydration console errors via Playwright; Vercel runs the app build script directly so the prerender runs on deploy.

## 2026-06-16 (Data-access seam — repository layer, Phase 3 complete)

Implemented the **data-access seam** from the `data-access-seam` OpenSpec change: a repository layer between API services and Drizzle that centralizes tenant scoping, makes services unit-testable, and is the prerequisite for transactions (#2) and centralized scoping (#5).

### Shipped (one PR per service / cluster, all merged, CI green)
- **Seam + reference**: `repositories/types.ts` (`Executor = DB | DbTransaction`), `table` (#29)
- **Core flow**: `guest` (#30), `reservation` (#31), `waitlist` (#33)
- **Loyalty/visit**: `visit` (#34), `loyalty` (#35) — idempotency/points filters preserved 1:1
- **Gamification**: `achievement`+`reward-claims` (#36), `challenge` (#37), `referral`+`gamification-share`+`leaderboard` (#40)
- **Automation/messaging**: `campaign` (#38), `engagement` (#39), `feedback`+`outbound-message` (#41)
- **Membership/reporting**: `membership-summary`+`membership-processing` (#42), `summary`+`analytics` (#43)

### Impact
- **20 services** migrated behind **~18 repositories**; services no longer import the `db` singleton.
- Inline `eq(table.restaurantId, …)` tenant filters: **86 → ~0 in migrated services** (centralized in repositories).
- First-ever **API unit tests** (~76) — services tested with mocked repositories, no PostgreSQL. Vitest wired into `@openseat/api`.
- Repository conventions documented in `CONVENTIONS.md` §6a.

### Deliberately not migrated (low seam value)
- `diagnostics.service.ts` (2294 lines, ~30 raw `db.execute(sql)` health probes — infrastructure diagnostics, no tenant-scoped writes), `agent-tools.ts`, and the dead `agent.service.ts`. These legitimately keep `db` access.

### Next (await direction — behavior-changing / opinionated)
- **#2 Transactions** (OpenSpec group 4): wrap a multi-write flow (e.g. visit completion) in `db.transaction`, threading `tx` through repos. The executor seam already supports this. **Behavior-changing — review before merge.**
- **Centralized scoping (#5)** and the **CI guard** forbidding `import db` in services (group 5.2): must exempt diagnostics/agent-tools.

## 2026-06-16 (Marketing brand bundle applied)

### Shipped
- **PR #28** `feat(marketing): apply OpenSeat brand bundle (logo, favicon, OG, manifest)` — applied the new OpenSeat brand assets (delivered as `OpenSeat-1.zip`) to the marketing site.
  - Full bundle committed under `apps/marketing-site/public/branding/` (mark, wordmark, favicons, avatars, social, tokens, brand guide, email signature). Served at `/branding/*` and preserved in git so nothing is lost.
  - Wired favicons + `apple-touch-icon` + `mask-icon` + PWA `manifest` into `index.html` (the page previously had **no favicon**); added `site.webmanifest` at the public root.
  - Refreshed `og-image.png` with the on-brand 1200x630 artwork.
  - Replaced the placeholder header/footer mark with the real OpenSeat chair mark.
  - Color tokens in `index.css` already matched the bundle (`#C41E3A` etc.), so no token changes were needed.
  - Verified `pnpm build` / `type-check` / `lint` all pass; `dist/` emits the branding assets and favicon links.

## 2026-06-15 (Architecture review + safe infra wins)

### Architecture review
- Ran the `improve-codebase-architecture` skill (Matt Pocock) across the whole repo with four parallel readers (API services + DB, API HTTP layer + workers, `@openseat/domain` + boundaries, build/CI/deploy).
- Produced a 15-candidate deepening report at `/tmp/architecture-review-20260615.html`. Top recommendation: a **data-access seam (repositories)** — kills 86 hand-written `eq(…restaurantId)` filters, and is the prerequisite for unit-testable services, transactions (#2), and centralized scoping (#5).
- Other strong candidates: transactions (only 1 `db.transaction` in the whole API), visit-completion orchestrator, one `ApiError` + central classifier (replaces 8× per-route error helpers), access-control hooks (5× duplicated gates), single source of truth for shared types (`MembershipSummary` defined 3×; widget shadows domain types).

### Shipped (3 safe-win PRs off main)
- **PR #23** `chore(infra): remove dead Vercel API project config` (#11) — API runs on the VPS, not Vercel; removed `apps/api/vercel.json` (the failing PR check) + documented VPS-only in ARCHITECTURE.md. Follow-up: unlink the `restaurant-agent-api` Vercel project.
- **PR #24** `ci: run build/type-check/lint for all packages via Turbo` (#12) — CI previously only type-checked the API; now `turbo build type-check lint` covers every workspace.
- **PR #25** `test: add Vitest foundation with first domain tests` (#14) — first-ever unit tests (21) on `@openseat/domain` (dashboard-access + Zod schemas); `test` turbo task wired into CI; e2e excluded.

### Next
- Decide whether to proceed with the data-access seam (#1) via the skill's design loop, then it unblocks deeper service tests.

## 2026-05-27 (Debugging infrastructure pass)

### Added
- Configurable off-peak loyalty multipliers:
  - restaurant `dashboardConfig.loyalty.offPeakMultipliers` accepts enabled time windows, optional day filters, and multiplier values
  - reservation completion multiplies visit-completion points by the matching off-peak window while preserving existing tier, stamp, host bonus, and idempotency behavior
  - API smoke temporarily configures an off-peak window around the actual created reservation time and verifies the visit-completion transaction receives doubled points
- Menu exploration badges:
  - visit logs now update `guest.preferences.menuExploration` from item categories and unlock exploration badges at category milestones
  - membership summary and the guest detail membership panel expose menu badge progress
  - diagnostics/debug-bundle summaries include menu badge adoption, and API smoke verifies the `menu_explorer` badge unlocks from visit items
- Win-back automation hardening:
  - 30/60/90-day win-back checks now catch due or overdue guests instead of relying on an exact last-visit date match
  - win-back checks avoid repeatedly scheduling the same tier for a guest once any job for that tier exists
  - diagnostics/debug-bundle summaries expose unscheduled win-back due counts, and API smoke verifies a 31-day lapsed guest gets a pending `win_back_30` job
- Birthday automation:
  - daily restaurant birthday checks schedule a promotional birthday greeting for guests whose saved birthday is today
  - manual `POST /api/v1/engagement/birthdays/check` uses the same tenant checks and policy gates as other engagement automation
  - diagnostics/debug-bundle summaries expose unscheduled birthday greetings due today, and API smoke verifies the birthday path creates an engagement job
- First-visit anniversary automation:
  - daily restaurant anniversary checks schedule a promotional anniversary greeting for returning guests on their first-visit anniversary
  - manual `POST /api/v1/engagement/anniversaries/check` uses the same tenant checks and policy gates as other engagement automation
  - diagnostics/debug-bundle summaries expose unscheduled anniversary greetings due today, and API smoke verifies the anniversary path creates an engagement job
- Birthday-week challenge automation:
  - daily birthday-week checks create private one-visit challenges for guests whose birthday is within seven days
  - challenge metadata targets the challenge to the birthday guest so it does not leak into unrelated member challenge lists
  - diagnostics/debug-bundle summaries expose active birthday-week challenges and due guests missing a challenge, and API smoke verifies reward points plus cleanup
- WhatsApp-ready referral retrieval/share flow:
  - `GET /api/v1/loyalty/:guestId/referral-share` generates or returns a member referral code
  - response includes referral stats and Hebrew/English share copy
  - agent tool `get_referral_share` lets customer conversations fetch referral copy by phone
- Staff-editable hospitality context for future member arrivals:
  - guest profiles can save structured signals like birthday, celebration, VIP, regular, owner friend, and house-comp
  - guest profiles can save a staff-facing hospitality note
  - Today and Reservations views surface saved hospitality signals on future arrivals
- Membership messaging policy enforcement:
  - engagement jobs now distinguish transactional vs promotional messages
  - promotional jobs respect guest opt-out state and a two-per-week pacing limit
  - skipped promotional jobs store a machine-readable `skipReason` for debugging
- Membership access-boundary E2E coverage:
  - employees are blocked from reward catalog management and membership-processing repair
  - employees can verify and redeem reward claims
  - employees can restore member messaging preferences through the operational opt-out flow
- Agent membership intent debugging:
  - agent tools now include membership summary and membership-message opt-out actions
  - `/api/v1/agent/debug/membership-intent` maps common WhatsApp membership phrases to expected tools without an LLM call
  - E2E probes cover Hebrew/English balance, rewards, referral, and opt-out intents
  - agent tool traces now classify malformed LLM tool arguments separately from tool execution failures, making bad tool-call JSON visible without losing the request to a generic agent error
- Owner-facing morning summary operations:
  - analytics dashboard now previews the WhatsApp-style daily morning summary with owner-recipient readiness, notable guests, and alerts
  - admins can manually log the morning summary to the outbound message trail for delivery debugging and support follow-up
- Queue debugging:
  - `pnpm debug:queues` prints BullMQ counts, repeatable schedules, failed samples, and delayed samples for reminder, summary, engagement, and campaign queues
  - debug bundles include `queue-debug-summary.txt` so scheduled automation issues show queue state without a separate Redis inspection step
- Outbound delivery diagnostics:
  - workers and manual morning-summary logging now use one outbound delivery helper
  - missing outbound recipients are recorded as `skipped` with `OUTBOUND_RECIPIENT_MISSING` instead of looking like a normal logged send
- Debug CLI authentication:
  - membership and outbound debug CLIs can synthesize a short-lived super-admin token from `JWT_SECRET` when no explicit `OPENSEAT_TOKEN` is provided
  - CLI output reports whether the token came from the caller or the local JWT secret
- Debugging runbook:
  - `docs/DEBUGGING.md` now documents the token fallback, outbound message trail filters, skipped-message reasons, and queue-state checks
  - debug-tool tests assert the operator runbook keeps covering membership, outbound, and queue triage commands
- Protected super-admin dependency diagnostics at `GET /api/v1/admin/diagnostics`:
  - database ping status and latency
  - Redis ping status and latency
  - sanitized dependency error name/code/message
  - runtime flags without secret values
- Post-visit membership processing failure repair visibility:
  - new `membership_processing_failures` table
  - reservation completion now records failed membership stages with stage/error context
  - owner/admin API can list open/resolved failures and retry a failed stage
- Request ID propagation for API requests:
  - API accepts trusted `x-request-id` values or generates a UUID per request
  - every API response now exposes `x-request-id`
  - CORS exposes `x-request-id` so dashboard/browser code can read it
- Central Fastify error handler:
  - normalizes unhandled API errors into `{ error, code, requestId }`
  - returns Zod validation details for validation failures
  - logs method, URL, user, role, restaurant, request ID, and error code
- Dashboard `ApiError` helper:
  - preserves HTTP status, method, URL, code, request ID, and validation details
  - logs API failures to the browser console with request IDs and ready `pnpm debug:logs ...` commands, while keeping validation details local-development only
  - replaces generic `API error: <status>` failures across dashboard hooks/auth flows
  - preserves auth API error codes through login and signup, so invalid credentials can stay user-friendly while real auth/onboarding failures keep request IDs for log tracing
- Booking-widget availability and reservation failures now include HTTP status, stable API code, and request ID in visible errors, and log a browser-console debug payload with the matching `pnpm debug:logs` command.
- `pnpm debug:api` probe script for quickly checking endpoint status, elapsed time, request ID, content type, and body.
- `docs/DEBUGGING.md` with request-ID triage steps, log lookup commands, and debugging commands.
- Settings reward management now surfaces reward-catalog load failures with the same formatted HTTP/code/request-ID details as the loyalty dashboard instead of looking like an empty reward list.
- Staff reward claim verification now classifies not-found and already-redeemed responses by stable API code while preserving HTTP/code/request-ID details in the visible feedback.

### Changed
- API startup, worker, cron scheduling, and shutdown messages now use structured Fastify logs.
- Added validated `LOG_LEVEL` env var and documented it in `.env.example`.
- README now links to the debugging guide.
- Active challenge listings and visit-triggered challenge auto-progress now evaluate date windows with the restaurant-local calendar day, matching birthday-week challenge creation and preventing midnight timezone gaps in gamification/member-visible challenges.
- API reliability smoke date windows now use the same restaurant-local calendar day so live gamification checks exercise the product behavior instead of UTC-only artifacts.
- Birthday-week challenge checks now accept an optional `guestId` for targeted support/smoke runs and return sample created/existing challenge IDs, so a failing retention challenge check points at concrete guest/challenge records instead of only aggregate counts.
- Outbound diagnostics now include machine-readable status reasons plus `ownerDeliveryBlocked` and `ownerWhatsappConfigOnlyMissing`, so support can distinguish current delivery blockers from historical skipped rows and owner WhatsApp configuration cleanup.
- Dashboard Settings now exposes restaurant WhatsApp, owner phone, and canonical owner WhatsApp fields, giving operators a UI path to clear owner-summary configuration warnings without using the repair CLI.
- Outbound error-code diagnostics now include first/last seen timestamps and debug bundle summaries print the window next to each error code, making historical delivery residue visibly different from fresh regressions.
- Debug bundles now collect both the requested context log window and a bundle-run-only API log slice, so a fresh smoke regression is not confused with older warnings still inside the broader journal window.
- Debug bundle summaries now classify the bundle-run API log slice and print fresh warning/error counts, error codes, and samples, separating expected negative-path smoke warnings from unexpected runtime noise.
- Owner delivery readiness now has a guarded single-restaurant repair mode that patches a known owner WhatsApp value through the API and immediately re-checks readiness.
- Debug bundles can now fail after writing artifacts when `--fail-on-api-log-issues=true` finds unexpected warnings/errors in the bundle-run API log slice.
- Debug artifact summaries now print the last smoke steps and recent requests for failed API smoke reports, so assertion failures in gamification, loyalty, membership, and retention checks point at the exact product area and request IDs.
- Queue debug failed-job samples now include processed/finished timestamps and the first stacktrace lines, making delayed automation and retention job failures easier to match to logs and source code.
- Membership debug summaries now call out overdue pending and failed engagement jobs with trigger timestamps and age, so retention automation issues are visible from the bundle without scanning the full job list first.
- Debug artifact summaries now parse membership debug output and surface overdue/failed engagement-job counts plus skipped retention reasons in the top-level bundle summary.
- Debug artifact summaries now parse campaign queue diagnostics and surface skipped campaign reasons plus overdue campaign sample counts in the top-level bundle summary.
- Engagement list endpoints now wrap outbound-message and engagement-job read failures with stable error codes plus request IDs, so retention dashboard/debug reads can be traced directly in logs.
- Analytics dashboard failures are now labeled by surface and rendered as a partial-data warning, so a retention/loyalty/CLV/campaign query failure keeps HTTP/code/request-ID details without hiding healthy analytics sections.
- Visit and feedback routes now log persistence/read failures at error level with stable codes for visit history, insights, and feedback summaries, preserving request IDs on paths that feed loyalty/gamification state.
- Feedback sentiment LLM fallback logs now include a stable code, safe failure reason, model, rating sentiment, and feedback length so review-routing regressions can be diagnosed without exposing guest text.
- Queue worker failures now emit stable queue-specific codes plus retry/timing context for reminders, daily summaries, engagement jobs, campaign delivery, and invalid/missing engagement records, making membership and retention automation failures searchable from service logs.
- Engagement scheduling now logs created/reused/skipped jobs with source, trigger, queue-delay, and reservation context; enqueue failures mark the engagement row failed with `queue_enqueue_failed` and emit `ENGAGEMENT_JOB_QUEUE_ENQUEUE_FAILED`.
- Guest CRM routes now wrap list, lookup, reservation history, profile, sentiment, auto-tag, preference, and update failures with guest-specific 500 codes and request IDs so hospitality and retention profile bugs point straight at the failing read/write.
- Waitlist routes now wrap add, list, lookup, offer, accept, and cancel failures with stable waitlist-specific 500 codes and restaurant/waitlist context for faster reservation overflow triage.
- Table routes now wrap list, create, lookup, update, and deactivate failures with stable table-specific 500 codes and table/restaurant context, tightening floor-plan and availability debugging.
- Restaurant/settings routes now wrap list, lookup, update, dashboard, summary, table-status, reset, and nested-table failures with stable restaurant-specific 500 codes for faster tenant and owner-dashboard triage.
- Admin diagnostics and super-admin restaurant listing now wrap report/tenant-load failures with stable admin-specific 500 codes so debug bundle and owner-delivery tooling failures are easy to trace.
- Auth login/signup now wraps lookup, password verify/hash, response-build, and tenant-provisioning failures with stable auth-specific 500 codes for faster onboarding and access triage.
- Dashboard chat now distinguishes provider HTTP errors, invalid provider JSON, empty provider content, timeouts, and internal failures with stable chat-specific codes and provider timing/status context.
- Agent message failures now classify LLM config, timeout, provider, and reset failures with stable codes while logging request IDs and safe sender/message metadata for faster agent triage.
- Loyalty and membership read/update paths now return route-specific error-level codes with guest/restaurant context for processing failures, summaries, balances, history, referrals, reward lists, claim verification, preferences, and stamp cards.
- Unexpected loyalty claim/reward failures now return error-level `LOYALTY_OPERATION_FAILED` responses instead of being flattened into client-style 400 errors.
- Loyalty routes now wrap guest and claim preflight lookups with stable loyalty-specific codes, so reward claims, staff redemption, balance/history/summary, referral-share, opt-out, and stamp-card read failures keep request IDs plus member/reward context.
- Unexpected reservation availability/create/list/update/no-show/cancel failures now return reservation-specific error-level codes with restaurant/reservation context instead of falling through to generic handling.
- Loyalty dashboard retention actions now include a next-best-action recommendation for each queued member, covering recovery, win-back, opt-in, referral, and recognition follow-up.
- Gamification route catches now classify service failures by status and log unexpected persistence/internal failures at error level instead of flattening every caught failure into a warning-level HTTP 400.
- Campaign route catches now preserve campaign-specific context for unexpected delivery/create/event failures and return error-level HTTP 500 envelopes instead of falling through to less specific global handling.
- Analytics route catches now add surface-specific context for reservations, retention, loyalty, CLV, campaign ROI, and morning-summary failures while preserving stable 400/404 envelopes for known date and restaurant errors.
- Analytics date validation now uses typed input errors with stable `ANALYTICS_DATE_FORMAT_INVALID` and `ANALYTICS_DATE_RANGE_INVALID` 400 responses, avoiding brittle message matching on retention/loyalty analytics failures.
- Gamification routes now wrap guest/challenge preflight lookups and active-challenge listing with gamification-specific error codes, so referral, challenge, leaderboard, share-template, and streak failures keep request IDs plus member/challenge context instead of falling into generic errors.

### Verified
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api type-check`
- `pnpm --filter @openseat/dashboard type-check`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm debug:api -- http://localhost:3001/api/v1/health`
- `OPENSEAT_SMOKE_ARTIFACT_PATH=/tmp/openseat-smoke-64d8552.json node scripts/api-reliability-smoke.mjs`
- `pnpm test:debug-tools`
- `git diff --check`

### Notes
- A temporary API start using root `.env` reached startup but failed when scheduling recurring jobs because local Postgres rejected the configured `openseat` credentials. Build/type verification is clean; runtime restart/deploy should use the production service environment.

---

## 2026-04-26 (Telegram HQ E2E testing prep)

### Added
- OpenSpec change `openspec/changes/telegram-hq-e2e-testing/` with proposal, design, capability spec, and a detailed Hebrew-first Telegram E2E checklist.
- Clean `OpenSeat HQ` sandbox tenant (`openseat-hq`) cloned from BFF structure for Telegram customer-flow testing until WhatsApp access is live.

### Changed
- Telegram General is now treated as the temporary WhatsApp sandbox for customer-facing Hebrew reservation tests.
- BFF live data reset is documented as destructive and requires explicit wipe scope before execution.

### Verified
- `OpenSeat HQ` provisioned with 15 tables and zero guests/reservations/waitlist/reward claims.
- Current BFF operational counts recorded before any wipe: 238 guests, 147 reservations, 41 waitlist entries, 78 loyalty transactions, 10 rewards, 8 reward claims.

---

## 2026-04-14 (Self-serve dashboard onboarding)

### Added
- Public self-serve signup flow at `POST /api/v1/auth/signup` that provisions a restaurant tenant, owner admin, and initial tables in one transaction.
- Shared onboarding payload schemas/types in `@openseat/domain` for owner details, restaurant details, operating hours, and initial tables.
- Dashboard onboarding wizard at `/signup` with owner, restaurant, hours, and repeatable table steps plus auto-login into the new workspace.
- Dedicated onboarding verification script at `apps/e2e/src/test-self-serve-onboarding.ts` and package script `pnpm --filter @openseat/e2e test:onboarding`.

### Changed
- Login page now includes a clear CTA for new restaurants to start self-serve onboarding.
- Signup and login now share the same auth session response shape so the existing dashboard localStorage model can be reused unchanged.
- Restaurant slugs are now generated from the submitted restaurant name and auto-suffixed on collision.
- Table create/update validation now reuses the same seat-range rules as onboarding.

### Verified
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm --filter @openseat/e2e type-check`
- `OPENSEAT_API_URL=http://localhost:3104 pnpm --filter @openseat/e2e test:onboarding`
  - confirmed signup returns an authenticated admin session
  - confirmed initial tables exist for the new tenant
  - confirmed the new owner can log back in
  - confirmed the super-admin restaurant list includes the new tenant
- `sudo systemctl restart openseat-api`
- Browser-verified local dashboard onboarding from `/login` → `/signup` → auto-login into a fresh restaurant workspace on `/today`
- Browser-verified newly created owner can log out and log back in with the new credentials

---

## 2026-04-14 (Pilot sandbox tenant + assisted onboarding runbook)

### Added
- OpenSpec change `openspec/changes/pilot-sandbox-onboarding/` with proposal, design, tasks, and capability specs for sandbox provisioning and the current assisted onboarding path.
- Reusable sandbox provisioner at `apps/api/scripts/provision-pilot-sandbox.mjs` plus API package script `pnpm --filter @openseat/api provision:sandbox`.
- `docs/PILOT-ONBOARDING-CHECKLIST.md` documenting the current zero-to-onboarding pilot flow, credentials handoff, and first-run checks.

### Changed
- Pilot operations can now create a clean second tenant from the BFF baseline without copying live operational data.
- Super-admin demo flow is now backed by a real second restaurant (`BFF v2`) instead of a single-tenant demo.
- Onboarding expectations are now explicit: marketing/demo entry exists, but tenant creation is still assisted rather than self-serve.

### Verified
- Provisioned `BFF v2` sandbox tenant with isolated empty operational data and baseline table/config clone.
- Verified API login for both super-admin and sandbox admin.
- Verified live dashboard switching between `BFF Ra'anana` and `BFF v2`.
- Verified current public onboarding entry is still marketing/demo/contact, not self-serve tenant creation.

---

## 2026-04-14 (Referral-first loyalty visibility + membership docs)

### Added
- OpenSpec change `openspec/changes/loyalty-referral-visibility/` with proposal, design, tasks, and capability specs for referral-first loyalty visibility, reusable membership docs, and stronger backend coverage.
- `docs/MEMBERSHIP-FAQ.md` — general membership Q&A for reuse across restaurants.
- `docs/MEMBERSHIP-OPERATIONS-GUIDE.md` — operator/admin playbook for running loyalty, referrals, rewards, and messaging responsibly.

### Changed
- Loyalty dashboard `/loyalty` now treats referrals / bring-a-friend as a first-class surface with top-level referral stats, advocate visibility, referred-member visibility, and referral-ready reward context.
- Guest payloads now expose `referralCode` and `referredBy` end-to-end so dashboard loyalty views can show referral attribution without extra per-guest summary fetches.
- `docs/OWNER-GUIDE.md` now points operators to the new general membership FAQ and operations guide and better frames the loyalty dashboard workflow.
- `apps/e2e` coverage now asserts reward metadata create/update/summary round-trip, referral persistence/summary correctness, and messaging-preference persistence/restoration.

### Verified
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm --filter @openseat/e2e type-check`

---

## 2026-04-13 (Loyalty reward metadata + agent guidance)

### Added
- OpenSpec change `openspec/changes/loyalty-reward-templates/` with proposal, design, tasks, and capability specs for first-class reward templates and member reward guidance.
- Shared reward-template catalog in `packages/domain/src/reward-templates.ts` with stable template keys and normalized moment tags.
- Reward metadata fields on `rewards`: `templateKey`, `recommendedMoments`, `pitchHe`, and `pitchEn`.

### Changed
- Loyalty reward create/update/list flows now preserve template guidance instead of throwing it away after the owner clicks a template.
- Membership summary now exposes reward guidance metadata so Jake can see which live rewards fit birthday, comeback, referral, milestone, group, and host moments.
- Loyalty dashboard reward lists now show saved template badges, recommended moments, and guest-facing pitch copy for configured rewards.

### Verified
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `set -a && source /home/jake/openseat/.env && set +a && pnpm --filter @openseat/api db:migrate`
- Backend smoke test with temporary reward creation + cleanup confirmed metadata round-trips through `listRewards()` and `getMembershipSummary()`.
- Browser-verified local `/loyalty` dashboard shows the dedicated `מועדון` sidebar entry, the reward-template library, and saved reward guidance context (`מתי להשתמש`, `איך ג׳ייק מציע את זה`).

---

## 2026-04-13 (BFF loyalty templates + Telegram flow prep)

### Added
- `docs/BFF-BOT-PERSONA.md` — live BFF customer voice/playbook for WhatsApp + Telegram, including loyalty flow examples and test prompts.
- `docs/BFF-REWARD-TEMPLATES.md` — owner-facing reward template library for BFF offer strategy.
- Loyalty dashboard reward-template library with one-click prefills for owner/admin reward creation.

### Changed
- Loyalty dashboard now teaches the owner what to offer, not just how to CRUD rewards.
- WhatsApp/Telegram customer persona guidance now explicitly covers reward selection, pacing, birthday/referral/comeback flows, and BFF-specific tone.
- OpenSpec `whatsapp-membership-club` tasks updated to reflect defined guest-member flows and Hebrew-first copy readiness.

### Verified
- `pnpm --filter @openseat/dashboard build`
- Local dashboard browser verification of the new reward-template section and reward-management flow.
- Hermes customer-agent guidance updated for Telegram General / WhatsApp loyalty testing.

---

## 2026-04-13 (Dashboard loyalty view)

### Added
- Dedicated dashboard loyalty page at `/loyalty` with its own sidebar entry for admin and super-admin users.
- New reusable `LoyaltyRewardsManager` component shared between the loyalty page and Settings.
- Loyalty dashboard overview cards for member count, VIP count, active rewards, and repeat guests.
- Loyalty dashboard drill-down panels for top members and reward-program health.

### Changed
- Reward management is no longer buried as a tiny settings block; Settings now links into the dedicated loyalty dashboard while still exposing the reward manager inline.
- Dashboard access/page handling now recognizes `loyalty` as a first-class page.
- Loyalty page visibility is feature-driven so older `visiblePages` configs do not accidentally hide the new page.
- Hebrew and English dashboard copy now includes a full loyalty section.

### Verified
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm build`
- Browser-verified local dashboard rendering:
  - new `מועדון` sidebar item appears
  - `/loyalty` renders stats, top members, and reward management
  - Settings page shows a shortcut into the loyalty dashboard

---

## 2026-04-09 (Codebase review, cleanup, and conventions)

### Added
- `CONVENTIONS.md` — Comprehensive coding standards covering TypeScript rules, validation (Zod), auth patterns, DB query patterns (JOINs), error handling, multi-tenancy, security checklist, git workflow
- `.editorconfig` — Consistent formatting (2-space indent, LF, UTF-8)
- `eslint.config.js` — ESLint flat config with TypeScript rules (warns on `any`, non-null assertions)
- ESLint dependencies added to root workspace

### Fixed (Security)
- Auth middleware: tokens with missing/invalid role now rejected (was defaulting to `admin` — privilege escalation risk)
- Feedback routes: `GET /feedback/summary` now requires auth + tenant enforcement; `POST /feedback` properly registered as public route
- Chat route: no longer leaks raw API error details to clients

### Fixed (Performance)
- N+1 query in `listReservations`: replaced per-row guest lookup with single `LEFT JOIN`
- N+1 query in `listWaitlist`: replaced per-row guest lookup with single `LEFT JOIN`

### Fixed (Code Quality)
- `db/index.ts`: uses validated `env.DATABASE_URL` instead of `process.env!`, added connection pool settings
- `env.ts`: added `OPENROUTER_API_KEY`, `AGENT_MODEL`, `CHAT_MODEL` to Zod schema
- `agent.service.ts`: uses validated env, added 30s LLM timeout, proper response typing
- `chat.ts`: added Zod input validation, 30s timeout, configurable model via env
- `gamification.ts`: replaced unsafe `as {}` type casts with Zod schemas
- `queue/index.ts`: extracted shared `defaultJobOptions`, fixed Redis password URL-decoding
- `restaurants.ts`: removed `as any` cast on LEFT JOIN
- `index.ts`: cron job scheduling now dynamic (iterates all restaurants, not hardcoded slug)
- `.env.example`: documented all variables including seed accounts and AI config

### Removed
- Legacy "Sable" references from booking widget (`data-sable-booking`, `window.SableBooking`)

### Hermes Agent (MarkoKCOM/Hermes-Agent)
- Synced workspace to GitHub: 7 new OpenSeat skills, updated config, cron jobs, memories
- Updated `.gitignore` to exclude runtime state (SQLite, caches, locks)

### Verified
- `pnpm --filter @openseat/domain build` — clean
- `pnpm --filter @openseat/api build` — clean
- `pnpm --filter @openseat/dashboard build` — clean
- `pnpm --filter @openseat/booking-widget build` — clean
- API service restarted and running

---

## 2026-04-08 (Restaurant staff access + role-based dashboard)

### Added
- OpenSpec change `openspec/changes/restaurant-staff-access/` with proposal, design, tasks, and capability specs for restaurant-scoped employee access.
- New restaurant-scoped `employee` role alongside existing `admin` and `super_admin` roles.
- Role-aware login payload now returns `dashboardAccess` so the dashboard can render the correct page/action set.
- Dashboard auth context now understands permissions and exposes role-aware helpers (`canAccess`, `can`).
- Optional employee seed support via env:
  - `EMPLOYEE_SEED_EMAIL`
  - `EMPLOYEE_SEED_PASSWORD`
  - `EMPLOYEE_SEED_NAME`

### Changed
- Dashboard navigation and route guards now differentiate between:
  - `admin` (owner/admin full access)
  - `employee` (Today, Reservations, Waitlist only)
  - `super_admin` (platform-wide access)
- API authorization now layers role checks on top of tenant checks.
- Owner/admin-only API areas are blocked for employees, including guest CRM, settings writes, table management, loyalty admin flows, engagement admin flows, and visit/insight endpoints used by owner-style CRM screens.
- Operational APIs remain available to employees for service workflow, including dashboard snapshot, reservations, walk-ins, waitlist, and read-only restaurant tables needed by Today.

### Verified
- `pnpm --filter @openseat/api type-check`
- `pnpm --filter @openseat/dashboard type-check`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm --filter @openseat/e2e type-check`
- `OPENSEAT_API_URL=http://localhost:3103 pnpm --filter @openseat/e2e test` -> 21/21 passed
- `OPENSEAT_API_URL=http://localhost:3103 node scripts/api-reliability-smoke.mjs` passed
- Employee smoke validation on temp API:
  - login returns `role=employee` with pages `[today, reservations, waitlist]`
  - `GET /restaurants/:id/dashboard` succeeds
  - guests/settings/table-create endpoints return `403`
- Admin smoke validation on temp API:
  - login remains `role=admin`
  - guests/settings access still succeeds

## 2026-04-08 (Reservation lifecycle ops + walk-in flow)

### Added
- OpenSpec change `openspec/changes/reservation-lifecycle-ops/` with proposal, design, tasks, and capability updates for lifecycle timestamps, guided status actions, and walk-in operations.
- Reservation lifecycle timestamps across the stack:
  - DB columns: `confirmed_at`, `seated_at`, `completed_at`, `cancelled_at`, `no_show_at`
  - shared domain types/schemas now expose lifecycle metadata to API + dashboard
  - reservation service now records timestamps through a centralized transition flow
- Authenticated owner walk-in API: `POST /api/v1/reservations/walk-in`
- Dashboard owner workflow improvements:
  - guided lifecycle action buttons instead of free-form status edits
  - lifecycle history + source labels in reservation detail
  - Today view status controls aligned with backend rules
  - walk-in creation flow, including immediate seating
- E2E coverage additions for:
  - lifecycle timestamp assertions on confirm/seat/complete
  - both no-show paths (`POST /no-show` and `PATCH status=no_show`) including guest no-show counter updates
  - walk-in creation with and without immediate seating

### Fixed
- Reservations dashboard submit flow now calls the dedicated walk-in mutation instead of sending an invalid generic reservation payload.
- `scripts/api-reliability-smoke.mjs` now authenticates the table-status request so the API Smoke workflow matches the protected route behavior.
- Reservation lifecycle UI typing issues in `reservationLifecycle.ts` / `ReservationsPage.tsx` uncovered during verification.

### Verified
- `pnpm --filter @openseat/domain build`
- `pnpm --filter @openseat/api type-check`
- `pnpm --filter @openseat/dashboard type-check`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- `pnpm --filter @openseat/e2e type-check`
- `OPENSEAT_API_URL=http://localhost:3102 pnpm --filter @openseat/e2e test` -> 21/21 passed
- `OPENSEAT_API_URL=http://localhost:3102 node scripts/api-reliability-smoke.mjs` passed against a temp API after applying local SQL migration `0005_reservation_lifecycle_timestamps.sql`

## 2026-04-07 (Super-admin dashboard + tenant enforcement)

### Added
- OpenSpec change `openspec/changes/super-admin-dashboard/` with proposal, design, tasks, and capability updates for role-aware auth + multi-restaurant dashboard switching.
- Backend support for `super_admin` users:
  - `admin_users.role` enum (`admin` / `super_admin`)
  - nullable `restaurant_id` for platform-wide users
  - `GET /api/v1/admin/restaurants`
  - role-aware JWT/login response
- Dashboard support for platform admins:
  - role-aware auth state in `useAuth`
  - `/restaurants` picker page
  - sidebar link for switching active restaurant context
  - `X-Restaurant-Id` header for super-admin API requests

### Security / Enforcement
- Tightened auth middleware so only `GET /api/v1/restaurants` and `GET /api/v1/restaurants/:id` stay public; restaurant subroutes like `/dashboard` and `/table-status` are no longer accidentally public.
- Added tenant checks across core dashboard routes (`restaurants`, `reservations`, `guests`, `tables`, `waitlist`) so normal admins cannot cross restaurant boundaries by passing arbitrary IDs.

### Verified
- `pnpm --filter @openseat/api type-check`
- `pnpm --filter @openseat/dashboard type-check`
- `pnpm --filter @openseat/api build`
- `pnpm --filter @openseat/dashboard build`
- Applied DB migration `0004_admin_roles.sql` locally.
- Smoke-tested a temp API instance on port 3101:
  - super-admin login returns `role=super_admin` and `restaurant=null`
  - `GET /api/v1/admin/restaurants` returns tenant list for super-admin
  - regular restaurant admin gets `403` on that endpoint
- Fixed E2E auth/env drift after the rebase:
  - `apps/e2e` now auto-loads repo `.env` for direct local runs
  - table-status E2E now uses auth (route is intentionally protected)
  - public waitlist create/accept flows no longer crash when `request.user` is absent
  - full `pnpm --filter @openseat/e2e test` passes against a fresh temp API on port 3101 (15/15)
- Fixed the failing Vercel preview build on PR #5:
  - `apps/api/src/routes/agent.ts` now passes a concrete `AgentRequest` type into the legacy agent handler
  - verified locally with `pnpm --filter @openseat/api build`, `pnpm --filter @openseat/api type-check`, and `pnpm --filter @openseat/dashboard build`

### Notes
- Updated `milhemsione@gmail.com` in the local DB to `super_admin` for validation.
- Current picker shows one tenant (BFF Ra'anana) today, but the flow is now ready for multi-restaurant onboarding.

## 2026-04-07 (Guides + Sprint 3b completion)

### Verified
- All Sprint 3b features confirmed implemented and functional:
  - Waitlist service + auto-match on cancellation
  - Guest preference editor in dashboard
  - Guest auto-tagging by visit count (חדש/חוזר/קבוע/VIP)
  - Dashboard login page + auth wrapper
- All 5 apps build cleanly (full turbo cache)

### Created
- `docs/OWNER-GUIDE.md` — comprehensive guide for restaurant owner (dashboard, reservations, guests, loyalty, engagement, daily workflow)
- `docs/CUSTOMER-GUIDE.md` — customer-facing guide (widget booking, chat booking, loyalty program, waitlist)
- `docs/CUSTOMER-GUIDE-HE.md` — Hebrew version of customer guide

### Infrastructure
- Telegram group configured: OpenSeat (-1003691973621) with topics (General=1, Owner=17, Reports=20)
- Hermes bot already connected to group via openclaw config

### Still Needed
- Telegram bot bridge for customer-facing agent testing (separate from Hermes, needs @BotFather token)
- WhatsApp Baileys integration (parked for now)
- SSL/HTTPS (needs domain)
- Real BFF Ra'anana data (actual hours, table layout)

## 2026-04-06 (Sprint 3b completion + E2E test runner)

### Sprint 3b — Completed
- [x] Waitlist service + routes + auto-match on cancellation (was already built)
- [x] Guest preference editor in dashboard (GuestDetailPage with tags, notes, insights)
- [x] Guest auto-tagging by visit count (fires automatically on visit creation)
- [x] Dashboard login page + auth wrapper (ProtectedRoute, localStorage JWT)
- [x] Waitlist public routes (POST /waitlist and POST /waitlist/:id/accept)
- [ ] WhatsApp session manager — on hold, using Hermes+Telegram for testing

### CI/CD Fixes
- Fixed PR #1 and PR #2 — merged into single PR, resolved conflicts
- CI: build @openseat/domain before API type-check
- Smoke test: skip gracefully when GitHub secrets not configured
- Vercel deploy: fixed Drizzle ORM type mismatch (challenges innerJoin)

### E2E Test Runner (PR #3)
- Added `@openseat/e2e` package — 15 tests covering full API flow
- Tests: health, restaurants, availability, reservation CRUD, status transitions, loyalty, visits, guest profiles, tables, dashboard, waitlist
- All 15 passing in ~230ms against live API
- API client with auto token refresh on 401
- Set ADMIN_SEED_PASSWORD in .env for authenticated test flows
- Hermes can trigger via `pnpm --filter @openseat/e2e test`

## 2026-04-06 (Reliability audit + deployment hardening)

### Verified
- Confirmed Vercel CLI deployment inspection is currently blocked on this VPS without Vercel auth (`npx vercel inspect ...` returns `No existing credentials found`), so deployment-log diagnosis must use a logged-in Vercel session or token.
- Ran local + external API smoke coverage:
  - `scripts/e2e-test.sh` now passes end-to-end against the live local API service.
  - Added `scripts/api-reliability-smoke.mjs` to exercise login, availability, reservation creation/listing, status transitions, loyalty balance, table status, guest full profile, visit logging, and visit insights.
  - Verified the same smoke flow works against both `http://localhost:3001` and `http://204.168.227.45`.
- Rebuilt frontend apps successfully after fixes:
  - `@openseat/dashboard`
  - `@openseat/booking-widget`
  - `@openseat/marketing`

### Fixed
- Dashboard deployment path bug:
  - `apps/dashboard/vite.config.ts` no longer hardcodes `base: "/dashboard/"`; asset URLs now build for the actual deploy root by default.
  - `apps/dashboard/src/main.tsx` no longer hardcodes `basename="/dashboard"`.
  - Router basename now follows Vite `BASE_URL`, preventing blank-page behavior when the dashboard is deployed at the site root.
- Booking widget Vercel root 404:
  - Added `apps/booking-widget/scripts/postbuild-demo.mjs`.
  - Booking widget build now emits `dist/index.html` alongside `openseat-booking.iife.js`, so the deployed root URL serves a working demo page instead of Vercel `404: NOT_FOUND`.
- Booking widget API routing on Vercel:
  - Added `/api/:path*` rewrite to `apps/booking-widget/vercel.json` so the demo page can talk to the live API over the same origin.
- Admin login reproducibility:
  - Added optional `ADMIN_SEED_PASSWORD` env handling in `apps/api/src/env.ts` and `apps/api/src/db/seed.ts`.
  - Seed now syncs the existing admin password when `ADMIN_SEED_PASSWORD` is provided, instead of relying on a one-time random password.
  - Updated `.env.example` and `scripts/e2e-test.sh` to use environment-driven admin credentials instead of a stale hardcoded password.

### Remaining Follow-up
- `pnpm lint` is still not a trustworthy gate: frontend lint scripts call ESLint, but the workspace is not fully wired for a clean lint pass yet.
- To inspect failed Vercel deployments directly from this VPS, add Vercel auth (`vercel login` or token) for the deployment owner.

## 2026-04-04 (VPS Bootstrap + Sprint 1 Completion)

### Infrastructure
- Fresh VPS bootstrapped: Node v22.22.2, pnpm 10.30.3, PostgreSQL 16, Redis 7, Nginx
- Drizzle migrations generated and applied to production DB
- Seed data loaded: BFF Ra'anana restaurant, 10 tables, 3 test guests, 8 reservations (today + tomorrow)
- OpenSeat API running as systemd service on port 3001
- Nginx reverse proxy: `/api/*` → API, `/` → dashboard static files
- GitHub SSH (MarkoKCOM) + CLI (marciano147) verified

### Sprint 1 — Completed
- [x] Drizzle migrations (generate + run against PostgreSQL)
- [x] Seed script with BFF Raanana test data + reservations
- [x] Restaurant routes implemented (list, get, update, dashboard snapshot, tables)
- [x] Dashboard wired to API via React Query hooks:
  - Today page: live stats (reservations, covers, cancellations, no-shows) + reservation list
  - Reservations page: date/status filtering, status change actions (seat, complete, cancel)
  - Guests page: list with search, shows tier and tags
  - Settings page: editable restaurant details, operating hours display, table grid
- [x] Booking widget wired to real API:
  - Fetches available time slots from `/api/v1/reservations/availability`
  - Submits real reservations via POST
  - Error handling, loading states, back navigation
- [x] Added `/api/v1/health` route alias

### Sprint 2 — Completed
- [x] No-show tracking — `POST /reservations/:id/no-show`, increments guest noShowCount
- [x] Visit tracking — auto-increments visitCount + lastVisitDate on reservation completion
- [x] Operating hours enforcement — createReservation validates against restaurant hours
- [x] Dashboard occupancy heatmap — 30-min slot heatmap with amber color gradient
- [x] Guest profiles — detail page with visit history (last 20 reservations), clickable rows
- [x] No-show button on reservation actions (confirmed/seated)

### Sprint 3a — Completed (Claude Code)
- [x] JWT authentication on all API routes (fastify-plugin, global hook)
- [x] Login endpoint POST /api/v1/auth/login + admin user seeded
- [x] Settings hours editor — editable per-day time inputs with save
- [x] Settings table editor — add/edit/delete tables inline
- [x] Reservation detail panel — slide-over with full edit form
- [x] Widget branding — fetches widgetConfig, applies primaryColor/logo/welcomeText
- [x] Widget phone validation — Israeli format (0xx / +972)
- [x] Past-date rejection on createReservation (Asia/Jerusalem)
- [x] Marketing site rebuilt — bilingual HE/EN, launch offer, updated pricing
- [x] PACKAGES.md — full pricing/features/add-ons reference
- [x] ROADMAP.md updated to reflect actual state
- [x] OpenSpec sprint-3-pilot-ready change with 6 specs

### Sprint 3b — In Progress (Jake / OpenClaw)
- [ ] Waitlist service + routes + auto-match on cancellation
- [ ] Guest preference editor in dashboard
- [ ] Guest auto-tagging by visit count
- [ ] WhatsApp session manager skeleton (Baileys)
- [ ] WhatsApp handler stub + sender + admin routes
- [ ] End-to-end test flow

### Still Needed for Pilot Launch
- [ ] Dashboard login page + auth wrapper (redirect to /login if no JWT)
- [ ] SSL/HTTPS (needs domain pointed to VPS)
- [ ] Real BFF Ra'anana data (actual hours, table layout, menu)
- [ ] 1-week soft launch test with owner

## 2026-04-03 (Evening)

### Done
- Full monorepo scaffold with Turborepo + pnpm workspaces
- `apps/api` — Fastify server with Drizzle schema (all core + growth tables), route stubs for reservations/guests/tables/restaurants, zod env validation
- `apps/dashboard` — React + Vite + Tailwind, RTL layout with sidebar, 4 pages (Today, Reservations, Guests, Settings) with UI shells
- `apps/booking-widget` — Preact embeddable widget with multi-step booking flow (date → time → details → confirm), IIFE build config
- `apps/marketing-site` — React landing page with hero, features, pricing tables (Starter + Growth tiers), CTA
- `packages/domain` — Shared types (Restaurant, Table, Guest, Reservation, etc.) + Zod validation schemas
- Agent workspace files pushed to repo (SOUL.md, IDENTITY.md, USER.md, AGENTS.md, etc.)
- 15 skills linked to Jake (6 core + 5 autonomy + 4 React/design)
- MVP-PHASE-1.md locked, ROADMAP.md created, ARCHITECTURE.md updated

### What's Scaffolded (Structure Ready, TODO Logic)
- API route handlers — stubs with zod validation, need actual DB queries + domain logic
- Dashboard pages — UI shells with Hebrew labels, need API integration + data rendering
- Widget — multi-step flow, needs real availability fetch + reservation submit
- Marketing site — complete static landing page

### Next (Sprint 1 Remaining)
- [x] `pnpm install` + verify builds
- [ ] Drizzle migrations (generate + run against local PostgreSQL)
- [x] Seed script with BFF Raanana test data
- [x] Implement reservation service — availability check, auto table assignment, create/modify/cancel
- [x] Implement guest service — find-or-create, visit history
- [ ] Wire dashboard to API with React Query
- [ ] Wire widget availability fetch to real API

## 2026-04-03 (Afternoon — Sprint 1 API work)

### Done
- Ran `pnpm install` at repo root; workspace dependencies install cleanly.
- Fixed initial TypeScript issues in the monorepo (`@openseat/booking-widget` env handling, `@openseat/domain` TS project references).
- Implemented API service layer in `apps/api/src/services/`:
  - `guest.service.ts` — find-or-create by phone, list/get helpers, and preference/tags/notes updater, with mapping to shared domain `Guest` type.
  - `table.service.ts` — list helpers (with `includeInactive`), CRUD helpers for tables, and a smallest-fit table assignment helper.
  - `reservation.service.ts` — availability calculation based on restaurant operating hours + existing reservations, smallest-fit table assignment, create/list/update/cancel reservation flows, and mapping to shared domain `Reservation` type.
- Wired Fastify routes to use the new services and shared domain schemas:
  - `routes/reservations.ts` now uses `@openseat/domain` Zod schemas + reservation service for availability, create, list, update, and cancel.
  - `routes/guests.ts` now uses `@openseat/domain` Zod schema + guest service for list/get/create/update.
  - `routes/tables.ts` now uses table service for list/create/update/deactivate.
- Normalized Drizzle schema types for reservations/waitlist time & date columns to use string types in TypeScript, matching the shared domain model.
- Confirmed `pnpm type-check` passes across all workspaces (api, dashboard, booking-widget, marketing-site, domain).
- Added `apps/api/src/db/seed.ts` with BFF Ra'anana test data:
  - Upserts a `restaurants` record for BFF Ra'anana (slug `bff-raanana`) with address, contact info, operating hours, and basic widget config.
  - Seeds 10 tables with varying capacities for that restaurant.
  - Seeds a few test guests for that restaurant (idempotent by phone number).

### Next
- Wire dashboard pages to the new API services via React Query (today snapshot, reservations list, guests).
- Wire booking widget date step to `/api/v1/reservations/availability` and submit step to real reservation creation.
- Add a couple of seed reservations for BFF Ra'anana to make the dashboard and availability views feel real.
- Run Drizzle migrations against a local PostgreSQL instance and verify seed works end-to-end.

## 2026-04-03 (Initial)

- Reviewed existing specs in `openspec/changes/restaurant-agent-product-plan`
- Confirmed Phase 1: web-first (API + dashboard + widget + marketing), WhatsApp is Phase 1b
- Created initial directory structure
