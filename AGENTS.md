# AGENTS.md — OpenSeat Project Context

This file is read by Hermes Agent when working in this repo.

## Project

**OpenSeat** — AI-powered restaurant reservation and retention platform.

- **Monorepo:** Turborepo + pnpm (`apps/` + `packages/`)
- **API:** Fastify 5 + Drizzle ORM + PostgreSQL + BullMQ (port 3001)
- **Dashboard:** React 19 + Vite + Tailwind (Vercel)
- **Widget:** Preact IIFE bundle (Vercel)
- **Shared types:** `@openseat/domain`

## Key Paths

| Path | Purpose |
|------|---------|
| `apps/api/src/` | Backend routes, services, queue workers |
| `apps/api/src/db/schema.ts` | Full Drizzle schema (21 tables) |
| `apps/api/src/middleware/auth.ts` | JWT + multi-tenant + role guards |
| `apps/dashboard/src/` | Owner/staff React SPA |
| `apps/booking-widget/src/` | Embeddable booking widget |
| `packages/domain/src/` | Shared types + Zod schemas |
| `openspec/changes/` | Product specs and change proposals |
| `CONVENTIONS.md` | Coding standards (READ THIS FIRST) |

## Commands

```bash
pnpm dev              # Start all in dev mode
pnpm build            # Build all
pnpm db:generate      # Create migration from schema changes
pnpm db:migrate       # Apply migrations
pnpm db:seed          # Seed BFF Ra'anana data
sudo systemctl restart openseat-api  # Restart production API
```

## Rules

- **Read `CONVENTIONS.md`** before making changes — it has all coding patterns.
- All input validated with Zod, all routes enforce tenant isolation.
- Use JOINs, not N+1 loops. Use transactions for multi-step ops.
- No `as any`. No `process.env.X!` — use validated `env` from `env.ts`.
- Commit after each task. Push to main.
- Use `/opsx:propose` for planning features.
