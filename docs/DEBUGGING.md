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

Optional flags are `--service openseat-api` and `--context 2`. The script prints a small JSON header with match counts, then the matching journal lines with nearby context.

For local development, failed dashboard API requests are logged to the browser console with:

- `status`
- `method`
- `url`
- `code`
- `requestId`
- validation `details`, when the API returned them

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

Summarize either smoke or E2E artifacts without reading the full JSON:

```bash
pnpm debug:artifact /tmp/openseat-smoke.json
pnpm debug:artifact apps/e2e/artifacts/e2e-....json
```

When a smoke artifact has unhandled HTTP failures, the summary includes ready-to-run `pnpm debug:logs ...` commands for the failing request IDs.

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

- overall status: `ok` or `degraded`
- database ping status and latency
- Redis ping status and latency
- deployment metadata: Node version, process ID, working directory, code migration count/latest file, applied DB migration count/latest ID/hash, and migration drift status
- BullMQ queue counts for reservation reminders, daily summaries, and engagement jobs
- up to two failed-job samples per queue, including job ID, name, attempts, and sanitized failure reason
- sanitized failure name/code/message
- runtime flags such as `NODE_ENV`, `LOG_LEVEL`, selected AI models, and whether OpenRouter is configured

Use this when `/api/v1/health` is green but app workflows still fail.

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

For deterministic membership intent checks that do not call the LLM:

```bash
METHOD=POST \
BODY='{"message":"אפשר קוד חבר מביא חבר?"}' \
pnpm debug:api -- http://localhost:3001/api/v1/agent/debug/membership-intent
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

Feedback logs include structured `restaurantId`, `guestId`, optional `reservationId`, rating, sentiment, and channel fields.
