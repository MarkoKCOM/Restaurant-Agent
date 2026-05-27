# OpenSeat Debugging

This guide covers the first place to look when an API or dashboard flow fails.

## Request IDs

Every API response includes an `x-request-id` header. Unhandled API errors also include the same ID in the JSON body:

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

After pulling changes that touch `packages/domain`, rebuild it before checking apps that import `@openseat/domain`.

Use `pnpm debug:api` to inspect one endpoint quickly. It sends an `x-request-id`, then prints the response status, elapsed time, returned request ID, content type, and body. Optional environment variables:

- `METHOD=POST`
- `BODY='{"restaurantId":"..."}'`
- `OPENSEAT_TOKEN=...`
- `REQUEST_ID=debug-manual-1`

## Dependency Diagnostics

Super-admins can inspect runtime dependencies without exposing secrets:

```bash
OPENSEAT_TOKEN=... pnpm debug:api -- http://localhost:3001/api/v1/admin/diagnostics
```

The endpoint returns:

- overall status: `ok` or `degraded`
- database ping status and latency
- Redis ping status and latency
- sanitized failure name/code/message
- runtime flags such as `NODE_ENV`, `LOG_LEVEL`, selected AI models, and whether OpenRouter is configured

Use this when `/api/v1/health` is green but app workflows still fail.
