# OpenSeat Debugging

This guide covers the first place to look when an API or dashboard flow fails.

## Request IDs

Every API response includes an `x-request-id` header. API errors include the same ID in the JSON body:

```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "requestId": "..."
}
```

The dashboard preserves that ID in thrown `ApiError` messages, for example:

```text
Unable to create reservation (request 018f...)
```

Use that value to search API logs:

```bash
journalctl -u openseat-api --since "30 minutes ago" | rg "018f"
```

Or use the request-id tracer on the VPS:

```bash
pnpm debug:logs 018f --since "30 minutes ago"
```

Optional flags are `--service openseat-api` and `--context 2`. The script prints a small JSON header with match counts, a compact event summary when it can parse structured API logs, then the matching journal lines with nearby context.

Failed dashboard API requests are logged to the browser console with:

- `status`
- `method`
- `url`
- `code`
- `requestId`
- `debugCommand`, a ready `pnpm debug:logs ...` command when a request ID exists
- validation `details`, when the API returned them, in local development only

## API Log Level

Set `LOG_LEVEL` in `.env` to control Fastify/Pino logging:

```bash
LOG_LEVEL=debug
```

Allowed values are `fatal`, `error`, `warn`, `info`, `debug`, `trace`, and `silent`.

## Common Commands

```bash
pnpm --filter @openseat/domain build
pnpm --filter @openseat/api type-check
pnpm --filter @openseat/dashboard type-check
pnpm --filter @openseat/e2e test
node scripts/api-reliability-smoke.mjs
pnpm debug:api -- http://localhost:3001/api/v1/health
```

Vercel production deploys are path-filtered. Changes limited to debugging scripts, E2E tooling, or docs should still run CI/API Smoke, but should not spend Vercel deployment quota. Frontend app, package, lockfile, workspace, Turbo, or deploy-workflow changes still trigger the deploy workflow.

Collect a timestamped debug bundle with health probe output, optional admin diagnostics, optional membership repair summary, optional smoke output, summary files, and recent API logs:

```bash
pnpm debug:bundle --since "30 minutes ago"
```

The bundle is written to `artifacts/debug-bundles/<timestamp>/`. Set `OPENSEAT_TOKEN`, `JWT_SECRET`, or super-admin credentials to include `/api/v1/admin/diagnostics`, set `OPENSEAT_RESTAURANT_ID`, `OPENSEAT_BUNDLE_RESTAURANT_ID`, `OPENSEAT_RESTAURANT_SLUG`, `OPENSEAT_BUNDLE_RESTAURANT_SLUG`, or a restaurant-scoped `OPENSEAT_TOKEN` to include `pnpm debug:membership`, and set the normal smoke credentials to include the API smoke run. Use `--out /tmp/openseat-debug` to choose a specific folder.

The bundle writes two service-log slices. `recent-api-logs.txt` uses the operator-requested `--since` window for broader context; `bundle-run-api-logs.txt` starts at the bundle invocation timestamp so fresh regressions are not confused with older warnings from the same 30-minute window. The bundle summary also extracts warning/error counts, codes, and samples from the run-scoped log. Expected negative-path smoke warnings, such as starter-package rejections and intentional no-table probes, are counted separately from unexpected runtime noise.

For CI-style checks, add `--fail-on-api-log-issues=true` or set `OPENSEAT_BUNDLE_FAIL_ON_API_LOG_ISSUES=true`; the bundle still writes all artifacts, then exits non-zero if the run-scoped log contains unexpected warnings or errors.

Bundle summaries separate command failures from operational attention. If all bundle commands pass but a diagnostics section reports `attention`, `pnpm debug:artifact` prints `Operational attention` and `Bundle command issues: none` instead of hiding the operational signal behind `Bundle issues: none`.

When `JWT_SECRET` is available on the VPS, `pnpm debug:membership` and `pnpm debug:outbound` can synthesize a short-lived super-admin token. You still need a restaurant selector such as `OPENSEAT_RESTAURANT_ID` or `OPENSEAT_RESTAURANT_SLUG`. The scripts print `tokenSource=jwt_secret` or `tokenSource=provided` so support can see which auth path was used.

The bundle also runs authenticated deterministic membership-intent probes against `/api/v1/agent/debug/membership-intent`, covering balance, reward, referral, and promotional opt-out phrases. These checks do not call the LLM; they prove the agent debugging layer still maps common membership questions to the expected tools.

`pnpm debug:artifact <bundle>/manifest.json` reads the bundle's membership debug output and prints the overdue pending engagement-job count, failed engagement-job count, and skipped retention reasons in the top-level summary. It also reads queue campaign delivery diagnostics and prints skipped campaign reasons plus overdue campaign sample counts. Start there before opening `membership-debug-summary.txt` or `queue-debug-summary.txt` when retention automation looks wrong.

Engagement list endpoints return stable request IDs and log context for list/read failures: `OUTBOUND_MESSAGES_LIST_FAILED` on `/api/v1/engagement/outbound-messages` and `ENGAGEMENT_JOBS_LIST_FAILED` on `/api/v1/engagement/jobs`. Use the returned `requestId` with `pnpm debug:logs` before checking database state.

Visit and feedback persistence/read failures are logged at error level with stable request IDs because these paths feed loyalty, gamification, and retention state. Look for `VISIT_LOG_FAILED`, `VISIT_HISTORY_FAILED`, `VISIT_INSIGHTS_FAILED`, `FEEDBACK_SUBMIT_FAILED`, or `FEEDBACK_SUMMARY_FAILED` before inspecting guest membership records.

Unexpected loyalty claim/reward failures return `LOYALTY_OPERATION_FAILED` as a 500 and log at error level. Known member-facing conditions still use narrower 400/404/409 codes such as `LOYALTY_INSUFFICIENT_POINTS`, `LOYALTY_REWARD_NOT_FOUND`, `LOYALTY_CLAIM_NOT_FOUND`, or `LOYALTY_CLAIM_NOT_ACTIVE`.

The API reliability smoke creates future-dated and expired challenges to verify launch windows are respected, creates a short-lived current visit-count challenge, completes a test reservation, verifies that the guest challenge progress is created and completed, confirms a challenge-completion congratulations job is scheduled, retries the completed challenge to prove points are not awarded twice, verifies a configured lucky-spin prize and reward-delivery job, verifies broken-streak reset plus recovery scheduling, creates branded social sharing templates for achievement/streak/leaderboard moments, creates a targeted birthday-week challenge to prove private challenge visibility and bonus-point rewards, verifies campaign audience preview segmentation and campaign opt-out exclusion, then deactivates all smoke challenges. This catches regressions where challenges leak outside their active window, duplicate completion rewards are issued, challenge completion follow-up disappears, visit-triggered spin rewards fail, broken streak recovery disappears, share-ready retention moments disappear from the agent/dashboard payload, targeted birthday challenges leak to unrelated guests, campaign segments include opted-out guests by default, or the retention/gamification stage stops running even though the reservation itself completed successfully.

When operational diagnostics are degraded, the bundle README includes `Attention samples` with the first concrete membership failure, gamification issue, engagement job, campaign, or outbound message IDs. Start with those IDs before scanning logs; the full `admin-diagnostics.txt` keeps the complete sample payloads.

Before endpoint probes run, the bundle waits for `/api/v1/health` to become ready. Tune startup waiting with `OPENSEAT_BUNDLE_READY_TIMEOUT_MS` and `OPENSEAT_BUNDLE_READY_INTERVAL_MS` when collecting immediately after a restart.

After pulling changes that touch `packages/domain`, rebuild it before checking apps that import `@openseat/domain`.

The main E2E runner writes a JSON artifact for every CLI run. By default it lands under `apps/e2e/artifacts/<runId>.json` and includes the API URL, timings, pass/fail counts, and per-test details:

```bash
pnpm --filter @openseat/e2e test
```

Set `OPENSEAT_E2E_ARTIFACT_PATH` to write the artifact somewhere specific, such as a CI workspace path:

```bash
OPENSEAT_E2E_ARTIFACT_PATH=/tmp/openseat-e2e.json pnpm --filter @openseat/e2e test
```

The push-time API Smoke workflow also uploads an `api-reliability-smoke` artifact. When smoke credentials are configured, it includes every smoke request with method, path, HTTP status, elapsed milliseconds, generated request ID, returned request ID, and any stable error code. If credentials are missing, the artifact says the smoke run was skipped instead of leaving a green run ambiguous. For local smoke runs, set:

```bash
OPENSEAT_SMOKE_ARTIFACT_PATH=/tmp/openseat-smoke.json node scripts/api-reliability-smoke.mjs
```

Summarize smoke, E2E, or agent-intent artifacts without reading the full JSON:

```bash
pnpm debug:artifact /tmp/openseat-smoke.json
pnpm debug:artifact apps/e2e/artifacts/e2e-....json
pnpm debug:artifact /tmp/openseat-debug-bundle/manifest.json
```

When a smoke artifact has unhandled HTTP failures, the summary includes ready-to-run `pnpm debug:logs ...` commands for the failing request IDs.

When an E2E failure detail includes a request ID, the summary also prints matching `pnpm debug:logs ...` commands.

Use `pnpm debug:api` to inspect one endpoint quickly. It sends an `x-request-id`, then prints the response status, elapsed time, returned request ID, content type, and body. Optional environment variables:

- `METHOD=POST`
- `BODY='{"restaurantId":"..."}'`
- `OPENSEAT_TOKEN=...`
- `OPENSEAT_RESTAURANT_ID=...` to send `X-Restaurant-Id` for super-admin tenant context
- `REQUEST_ID=debug-manual-1`
- `EXPECT_STATUS=404`
- `EXPECT_CODE=ROUTE_NOT_FOUND`
- `EXPECT_REQUEST_ID=debug-manual-1`

When `EXPECT_STATUS` is set, non-2xx responses do not fail the probe just because they are errors. The probe fails only when the observed status, error `code`, or request ID does not match the expectation. This is useful for proving a debugging envelope without manually reading logs:

If the API cannot be reached at all, the probe still prints a compact JSON result with `status: null`, `ok: false`, the generated request ID, elapsed time, and sanitized connection error fields.

```bash
REQUEST_ID=debug-route-not-found \
EXPECT_STATUS=404 \
EXPECT_CODE=ROUTE_NOT_FOUND \
pnpm debug:api -- http://localhost:3001/api/v1/debug/not-found
```

## Dependency Diagnostics

Super-admins can inspect runtime dependencies without exposing secrets:

```bash
OPENSEAT_TOKEN=... pnpm debug:api -- http://localhost:3001/api/v1/admin/diagnostics
```

The endpoint returns:

- overall status: `ok` or `degraded`; operational `attention` sections also make the report `degraded`
- database ping status and latency
- Redis ping status and latency
- deployment metadata: Node version, process ID, working directory, running build git commit/branch/dirty state, current checkout git state, whether checkout matches the running build, code migration count/latest file, applied DB migration count/latest ID/hash, and migration drift status
- BullMQ queue counts for reservation reminders, daily summaries, and engagement jobs, including daily owner-summary schedule health for the expected 09:00 morning and 23:00 closing repeatables per restaurant
- up to two failed-job samples per queue, including job ID, name, attempts, and sanitized failure reason
- open post-visit membership processing failures, grouped by stage with recent samples, so loyalty/retention repair work is visible without hitting a separate endpoint first
- gamification health for active challenges, targeted birthday-week challenge creation, stuck challenge completions, referral-code adoption, referral reward-credit mismatches, achievement drift such as missing first-visit/10-visit badges, leaderboard opt-ins/reward finalization drift, and streak state problems such as stale streaks, invalid streak preferences, or missing milestone bonuses. The smoke test seeds a returning streak, verifies the milestone bonus is tied to the completed reservation, verifies challenge-completion and broken-streak recovery scheduling, confirms reservation/manual visits unlock membership achievements, exercises lucky-spin reward delivery and opt-in leaderboard ranking/finalization, and confirms social sharing templates remain available for the agent/dashboard.
- engagement automation health for pending, overdue, failed, skipped, unscheduled win-back-due guests, unscheduled birthday greetings due today, unscheduled first-visit anniversary greetings due today, pending thank-you jobs accidentally inside quiet hours, and review requests that do not have positive feedback behind them, including top skip reasons for retention/promotional policy decisions
- campaign health for draft/scheduled/sent counts, overdue scheduled campaigns, delivery totals, opt-out/rate-limit skip reasons, and recent campaign samples
- sanitized failure name/code/message
- runtime flags such as `NODE_ENV`, `LOG_LEVEL`, selected AI/chat/sentiment models, and whether OpenRouter is configured

Use this when `/api/v1/health` is green but app workflows still fail.

## Package Enforcement

Growth-only API surfaces should reject starter restaurants with a stable `PACKAGE_GROWTH_REQUIRED` error and include `requiredPackage: "growth"` plus the current `restaurantPackage` when known. Start with campaign, analytics, engagement, loyalty, or gamification endpoints when checking this guard:

```bash
REQUEST_ID=debug-package-campaign \
METHOD=POST \
BODY='{"restaurantId":"...","filter":{}}' \
EXPECT_STATUS=403 \
EXPECT_CODE=PACKAGE_GROWTH_REQUIRED \
OPENSEAT_TOKEN=... \
pnpm debug:api -- http://localhost:3001/api/v1/campaigns/audience-preview
```

Use the response `requestId` with `pnpm debug:logs` if a package rejection is missing or returns the wrong code.

To check all major Growth-only surfaces in one pass, run:

```bash
OPENSEAT_TOKEN=... pnpm debug:packages
```

On the VPS, `JWT_SECRET` is enough for this command to synthesize a short-lived super-admin token. The command discovers one starter and one Growth restaurant from `/api/v1/admin/restaurants`, then probes campaigns, analytics, engagement, loyalty, and gamification. It fails if a starter restaurant is not rejected with `PACKAGE_GROWTH_REQUIRED` or if a Growth restaurant cannot reach the same surface.

Queue diagnostics are especially useful for failures that happen after an API request returns, such as delayed reminders, daily owner summaries, thank-you messages, review requests, win-back jobs, or membership engagement automation.

Queue workers log structured fields through the API logger, including `queue`, job IDs, `restaurantId`, and relevant entity IDs. Guest phone numbers are masked in worker logs. Search by queue name or entity ID when investigating background behavior:

```bash
journalctl -u openseat-api --since "30 minutes ago" | rg '"queue":"engagement"|reservation-reminders|daily-summary'
```

## Membership Processing Failures

When a reservation is completed, OpenSeat runs several post-visit membership stages:

- visit auto-tags
- loyalty points/stamps/tier updates
- streak updates
- challenge progress
- thank-you / review engagement scheduling

If one stage fails, the reservation completion still returns, but the failed stage is persisted for repair:

```bash
OPENSEAT_TOKEN=... \
OPENSEAT_RESTAURANT_ID=... \
pnpm debug:membership
```

On the VPS, this is usually enough because the script can use `JWT_SECRET` to create a short-lived super-admin token:

```bash
OPENSEAT_RESTAURANT_ID=... pnpm debug:membership
```

Use `OPENSEAT_RESTAURANT_SLUG=...` instead of `OPENSEAT_RESTAURANT_ID` when you know the dashboard slug but not the UUID. If `OPENSEAT_TOKEN` belongs to a restaurant admin/employee, the script can infer the restaurant ID from the token. This prints open processing failures by stage/status, recent engagement-job counts, overdue pending and failed engagement-job samples with trigger timestamps/age, skipped engagement reasons, request IDs for API reads, log trace commands, and ready-to-run retry commands for repairable membership processing failures.

```bash
OPENSEAT_TOKEN=... pnpm debug:api -- \
  'http://localhost:3001/api/v1/loyalty/processing-failures?restaurantId=...&status=open'
```

Retry one failed stage:

```bash
METHOD=POST \
BODY='{"restaurantId":"..."}' \
OPENSEAT_TOKEN=... \
pnpm debug:api -- http://localhost:3001/api/v1/loyalty/processing-failures/.../retry
```

The retry marks the failure `resolved` on success. If it fails again, the API keeps it `open`, increments `attempts`, updates the sanitized error fields, and returns the updated failure in the response. Challenge-progress failures are visible but intentionally not auto-retried yet because the current challenge progress model does not have per-reservation idempotency.

Reservation completion failures also emit structured request logs with `stage`, `reservationId`, `guestId`, and `restaurantId` fields. Search for the stable messages when tracing why a repair row was created or why persistence failed:

```bash
journalctl -u openseat-api --since "30 minutes ago" | rg 'Reservation completion post-visit stage failed|Failed to record membership processing failure'
```

## Outbound Message Trail

Use the outbound summary when a WhatsApp-bound workflow says it was ready, sent, skipped, or failed but the operator needs the exact message ID and reason:

```bash
OPENSEAT_RESTAURANT_ID=... pnpm debug:outbound
```

Common filters:

```bash
OPENSEAT_RESTAURANT_ID=... pnpm debug:outbound -- --status skipped
OPENSEAT_RESTAURANT_ID=... pnpm debug:outbound -- --message-type daily_morning_summary
OPENSEAT_RESTAURANT_ID=... pnpm debug:outbound -- --status skipped --message-type daily_morning_summary --limit 5
```

The script prints counts by status, message type, provider, and error code, then recent rows with IDs, masked recipients, subject IDs, previews, and any `errorCode`/`errorMessage`. `/api/v1/admin/diagnostics` and debug bundle summaries also include outbound skipped counts, error-code totals with first/last seen timestamps, `ownerWhatsappMissing`, `ownerDeliveryBlocked`, `ownerWhatsappConfigOnlyMissing`, and sample restaurant IDs/slugs that need owner WhatsApp setup. For example, a missing owner WhatsApp number appears as `status=skipped` with `OUTBOUND_RECIPIENT_MISSING`; the morning owner summary can fall back to owner phone/restaurant phone while still flagging canonical owner WhatsApp setup as config cleanup.

Use this before reading logs when debugging retention automations such as birthday, anniversary, win-back, challenge-completion, leaderboard, reservation-reminder, or daily owner-summary delivery.

When owner-bound messages are skipped with `OUTBOUND_RECIPIENT_MISSING`, list every restaurant blocking owner delivery:

```bash
OPENSEAT_TOKEN=... pnpm debug:owner-delivery
```

On the VPS, `JWT_SECRET` is enough for this command to synthesize a short-lived super-admin token. The command reads `/api/v1/admin/restaurants`, prints masked restaurant phone/WhatsApp fields, and gives a ready-to-run `PATCH /api/v1/restaurants/:id` repair command for each restaurant missing `ownerWhatsapp`.

To apply one known owner WhatsApp value and immediately re-check readiness:

```bash
OPENSEAT_OWNER_DELIVERY_RESTAURANT_ID=... \
OPENSEAT_OWNER_DELIVERY_OWNER_WHATSAPP=... \
pnpm debug:owner-delivery -- --repair=true
```

## Queue State

Use the queue summary for delayed or scheduled background work:

```bash
pnpm debug:queues
```

It prints BullMQ counts, repeatable schedules, failed samples, and delayed samples for:

- `reservation-reminders`
- `daily-summary`
- `engagement`
- `campaign-delivery`

Phone, WhatsApp, email, token, password, and secret-like fields in job payload samples are masked. Failed job samples include enqueue, processed, and finished timestamps plus the first stacktrace lines so the failure can be matched to API logs and code quickly. This command is useful when the API request succeeded but the follow-up automation did not happen yet. For example, daily owner summaries should appear in `daily-summary` as repeatable `daily-morning-summary` jobs with `pattern=0 9 * * *` and the restaurant timezone. When `DATABASE_URL` is available, the queue summary also prints `summary schedule health` so missing or duplicate 09:00 morning summary and 23:00 closing summary repeatables are visible without manually counting restaurants. It also prints `campaign delivery health` for the `campaign-delivery` queue, including overdue scheduled campaigns, delivery totals, and opt-out/rate-limit skip reasons.

## Referral Share Flow

For WhatsApp membership referral issues, inspect the normalized share payload:

```bash
OPENSEAT_TOKEN=... pnpm debug:api -- \
  http://localhost:3001/api/v1/loyalty/.../referral-share
```

The response includes the reusable referral code, referral counts/points, and Hebrew/English share copy. The customer-facing agent can retrieve the same payload with the `get_referral_share` tool by guest phone number.

## Agent Message Diagnostics

Agent message responses include sanitized diagnostics:

- `diagnostics.requestId`
- `diagnostics.llmRounds`
- `diagnostics.toolTrace[]` with tool name, success flag, elapsed milliseconds, and sanitized error text

The API logs the same request ID, selected tools, and tool timings. Use this when Jake answers incorrectly or silently skips a tool:

```bash
REQUEST_ID=debug-agent-1 \
METHOD=POST \
BODY='{"restaurantId":"...","senderId":"debug-agent-1","guestPhone":"050...","message":"כמה נקודות יש לי במועדון?"}' \
pnpm debug:api -- http://localhost:3001/api/v1/agent/message
```

If the LLM/provider fails before a response is generated, the route returns:

```json
{
  "error": "Agent failed to process message",
  "code": "AGENT_ERROR",
  "requestId": "..."
}
```

Provider/config failures use narrower codes when the route can classify them: `AGENT_LLM_CONFIG_MISSING`, `AGENT_LLM_TIMEOUT`, or `AGENT_LLM_REQUEST_FAILED`. Conversation reset failures return `AGENT_RESET_FAILED`. All agent route failures include `requestId`, `restaurantId`, `senderId`, and safe message metadata in the API log, so start with `pnpm debug:logs <requestId> --since "2 hours ago"`.

For deterministic membership intent checks that do not call the LLM:

```bash
METHOD=POST \
OPENSEAT_TOKEN=... \
BODY='{"message":"אפשר קוד חבר מביא חבר?"}' \
pnpm debug:api -- http://localhost:3001/api/v1/agent/debug/membership-intent
```

On the VPS, `pnpm debug:agent-intents` can use `JWT_SECRET` to synthesize a short-lived super-admin token. `/api/v1/agent/message` remains public for inbound channel delivery, but `/api/v1/agent/reset` and `/api/v1/agent/debug/*` require authentication.

Run the full deterministic membership-intent smoke set:

```bash
pnpm debug:agent-intents
```

## Dashboard Chat Diagnostics

Dashboard chat provider failures return a stable code and request ID:

- `CHAT_NOT_CONFIGURED`
- `CHAT_PROVIDER_ERROR`
- `CHAT_PROVIDER_TIMEOUT`
- `CHAT_INTERNAL_ERROR`

The API logs include `requestId`, selected chat model, elapsed milliseconds, and provider status/body preview when applicable:

```bash
OPENSEAT_TOKEN=... \
REQUEST_ID=debug-chat-1 \
METHOD=POST \
BODY='{"messages":[{"role":"user","content":"How do rewards work?"}]}' \
pnpm debug:api -- http://localhost:3001/api/v1/chat
```

## Feedback And Visit Auto-Tagging

Visit logging and guest feedback can update guest tags asynchronously after the main operation succeeds. If a visit or feedback request succeeds but tags look wrong, search the API logs by request ID, guest ID, visit ID, or reservation ID:

```bash
journalctl -u openseat-api --since "30 minutes ago" | rg 'Auto-tag after|Feedback should'
```

Feedback logs include structured `restaurantId`, `guestId`, optional `reservationId`, rating, sentiment, sentiment source, confidence, rating-derived sentiment, matching positive/negative text signals, and channel fields. Clear complaint language such as cold food, long waits, rude service, or refund requests overrides a high star rating and routes privately to service recovery. Ambiguous neutral feedback can use the configured `SENTIMENT_MODEL` through OpenRouter, then falls back to rating sentiment if the model is unavailable.
