# OpenSeat

AI-powered restaurant management platform - reservations, guest CRM, loyalty, gamification, campaigns, and automation. All via WhatsApp and web.

## Quick Links

- **[PRODUCT-BRIEF.md](PRODUCT-BRIEF.md)** - Complete product reference (features, pricing, tech, roadmap, marketing copy)
- **[ROADMAP.md](ROADMAP.md)** - Phase timeline and current status
- **[PROGRESS.md](PROGRESS.md)** - Development log
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Tech stack and data flow

## Live

| App | URL |
|-----|-----|
| Marketing Site | https://marketing-site-nine-chi.vercel.app |
| Dashboard | https://dashboard-one-delta-38.vercel.app |
| API | VPS port 3001 (behind Nginx) |

## Monorepo

```
apps/
  api/              # Fastify + Drizzle + PostgreSQL + BullMQ
  dashboard/        # React + Vite + Tailwind + shadcn/ui
  booking-widget/   # Preact embeddable (under 20KB)
  marketing-site/   # React bilingual landing page
packages/
  domain/           # Shared TypeScript types + Zod schemas
```

## Dev

```bash
pnpm install        # Install all dependencies
pnpm dev            # Run all apps in dev mode
pnpm build          # Build everything
pnpm type-check     # TypeScript check across monorepo
```

## Pilot

BFF Ra'anana, Israel (free). First paying customers targeted at ₪499/mo (Starter) or ₪799/mo (Standard).
