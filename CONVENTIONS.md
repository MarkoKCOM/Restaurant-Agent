# OpenSeat — Coding Conventions & Standards

This document defines the rules and patterns for all OpenSeat development.
Follow these conventions for consistency, security, and maintainability.

---

## 1. Project Structure

```
apps/
  api/          # Fastify REST API (backend)
  dashboard/    # React SPA (owner/staff UI)
  booking-widget/  # Preact embeddable widget
  marketing-site/  # React landing page
  e2e/          # End-to-end tests
packages/
  domain/       # Shared types, Zod schemas, access rules
scripts/        # Deployment & utility scripts
openspec/       # Product specs & change proposals
docs/           # User-facing documentation
```

### File Naming
- **kebab-case** for all file names: `reservation.service.ts`, `guest.service.ts`
- Services: `<entity>.service.ts`
- Routes: `<entity>.ts` (in `routes/`)
- Workers: `<entity>.worker.ts` (in `queue/`)
- Use `.ts` for source, `.js` extensions in imports (ESM resolution)

---

## 2. TypeScript

- **Strict mode** is mandatory (`"strict": true` in tsconfig)
- **No `as any`** — use proper types or `unknown` with type guards
- **No non-null assertions (`!`)** on runtime values — use validation or nullish coalescing
- **Prefer `unknown` over `any`** in catch blocks: `catch (err: unknown)`
- Use `satisfies` for type-checking object literals where inference is needed
- Import types with `import type` when only used for type annotations

### Type Assertions
```typescript
// BAD — unsafe, hides bugs
const body = request.body as { guestId: string };

// GOOD — validates at runtime
const body = mySchema.parse(request.body);
```

---

## 3. Validation

- **All external input** (request bodies, query params, path params) must be validated with **Zod**
- Define schemas in the route file or in `@openseat/domain` if shared
- Never trust `request.body`, `request.params`, or `request.query` without parsing
- Use `.parse()` (throws on invalid) or `.safeParse()` (returns result object)

```typescript
// Define schema
const createGuestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  restaurantId: z.string().uuid(),
});

// Use in route
app.post("/", async (request, reply) => {
  const body = createGuestSchema.parse(request.body);
  // body is fully typed and validated
});
```

---

## 4. API Routes

### Pattern
Every route file exports an `async function <name>Routes(app: FastifyInstance)`.

```typescript
export async function guestRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => { ... });
  app.post("/", async (request, reply) => { ... });
}
```

### Auth Enforcement
- **All routes are authenticated by default** (via `authMiddleware`)
- Public routes must be explicitly listed in `PUBLIC_ROUTES` in `middleware/auth.ts`
- After auth, always call `enforceTenant()` to verify restaurant access
- Use `requireRestaurantAdmin()`, `requireOperationalRole()`, or `requireSuperAdmin()` for role checks

```typescript
// Standard auth pattern in a route
const err = enforceTenant(request.user!, body.restaurantId);
if (err) return reply.status(403).send({ error: err });
```

### Response Format
- Success: return the data object directly (Fastify auto-serializes)
- Error: `reply.status(4xx).send({ error: "Human-readable message" })`
- Never expose internal error messages, stack traces, or DB details to clients

### Status Codes
- `200` — success (GET, PATCH)
- `201` — created (POST)
- `400` — validation error
- `401` — missing/invalid auth
- `403` — forbidden (wrong tenant/role)
- `404` — not found
- `409` — conflict (invalid state transition)
- `500` — unexpected server error (log it, return generic message)

---

## 5. Database (Drizzle ORM)

### Query Patterns
- Use Drizzle query builder, not raw SQL
- **Always scope queries by `restaurantId`** (multi-tenant)
- Use JOINs instead of N+1 loops:

```typescript
// BAD — N+1 query
for (const row of rows) {
  const [guest] = await db.select().from(guests).where(eq(guests.id, row.guestId));
}

// GOOD — single JOIN
const rows = await db
  .select()
  .from(reservations)
  .leftJoin(guests, eq(reservations.guestId, guests.id))
  .where(eq(reservations.restaurantId, restaurantId));
```

### Transactions
Use transactions for multi-step operations that must be atomic:

```typescript
await db.transaction(async (tx) => {
  await tx.update(guests).set({ ... }).where(...);
  await tx.insert(loyaltyTransactions).values({ ... });
});
```

### Schema Changes
1. Edit `apps/api/src/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply
4. Always specify `onDelete` behavior on foreign keys

---

## 6. Services

- One service per domain entity: `reservation.service.ts`, `guest.service.ts`
- Services contain business logic; routes handle HTTP concerns
- Services receive plain objects, return plain objects (no Fastify types)
- Services throw errors for business rule violations; routes catch and format
- Import `db` from `../db/index.js`, not create new connections

---

## 7. Error Handling

```typescript
// In routes — catch service errors and format response
try {
  const result = await someService(body);
  return { result };
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  reply.code(400);
  return { error: message };
}
```

- **Never swallow errors silently** — at minimum, `console.warn()` with context
- **Never expose raw error objects** to API clients
- Use specific error classes for different error types when needed

---

## 8. Environment Variables

- All env vars are validated in `apps/api/src/env.ts` using Zod
- **Never use `process.env.X` directly** — always use the validated `env` object
- Secrets go in `.env` files only, never in code or git
- Add new vars to both `env.ts` schema and `.env.example`

---

## 9. Queue / Background Jobs (BullMQ)

- Queues are defined in `queue/index.ts`
- Workers are in `queue/<name>.worker.ts`
- Jobs must be idempotent (safe to retry)
- Always handle worker errors — log and decide whether to retry or fail

---

## 10. Frontend (Dashboard)

- **React 19** + **Vite** + **Tailwind CSS**
- State management: **TanStack React Query** for server state
- Routing: **React Router v7**
- Internationalization: `i18n.tsx` with Hebrew primary, English secondary
- All API calls go through query hooks or mutations
- Use `useAuth()` hook for auth context
- Component files: PascalCase (`TodayPage.tsx`, `GuestCard.tsx`)

---

## 11. Multi-Tenancy

- Every table has a `restaurant_id` column
- Every query must filter by `restaurant_id`
- Auth middleware sets `request.user.restaurantId`
- Super admins can override via `x-restaurant-id` header
- Never leak data between restaurants

---

## 12. Security Checklist

- [ ] All input validated with Zod
- [ ] Auth middleware checks on protected routes
- [ ] Tenant enforcement on every data access
- [ ] No secrets in code or git
- [ ] No `as any` bypassing type safety
- [ ] Error responses don't leak internals
- [ ] Rate limiting on public endpoints (agent, waitlist)
- [ ] CORS configured properly

---

## 13. Git & Workflow

- Commit after each completed task
- Write clear commit messages: `fix:`, `feat:`, `refactor:`, `chore:`
- Push to `main` branch (direct for now, PRs later)
- Update `PROGRESS.md` after work sessions
- Use OpenSpec (`/opsx:propose`) for planning larger changes

---

## 14. Testing

- E2E tests in `apps/e2e/` using custom runner
- Smoke tests in `scripts/api-reliability-smoke.mjs`
- Run `pnpm -F @openseat/e2e test` before deploying
- All new endpoints should have at least E2E coverage

---

## 15. Deployment

- **API**: VPS (systemd `openseat-api`), port 3001, behind Nginx
- **Dashboard**: Vercel
- **Booking Widget**: Vercel
- **Marketing Site**: Vercel
- API URL should be configured via environment variables, not hardcoded
