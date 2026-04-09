# TOOLS.md — Jake's Environment Reference

## VPS (204.168.227.45)

| What | Where |
|------|-------|
| **OpenSeat repo** | `/home/jake/openseat/` |
| **OpenSeat .env** | `/home/jake/openseat/.env` |
| **DB credentials** | `~/.openseat-db-credentials` |
| **Vercel token** | `~/.vercel-token` |
| **Hermes workspace** | `/root/.hermes/` |
| **Hermes agent (Python)** | `/root/.hermes/hermes-agent/` |
| **Hermes config** | `/root/.hermes/config.yaml` |
| **Hermes auth** | `/root/.hermes/auth.json` |
| **Hermes .env** | `/root/.hermes/.env` |

## Services

| Service | Command | Port |
|---------|---------|------|
| OpenSeat API | `sudo systemctl restart openseat-api` | 3001 |
| Hermes Gateway | Running as root process | 8642 |
| Hermes Workspace UI | `sudo systemctl start hermes-workspace` (disabled) | 3002 → 8080 |
| PostgreSQL | `sudo systemctl status postgresql` | 5432 |
| Redis | `sudo systemctl status redis` | 6379 |
| Nginx | Reverse proxy | 80/8080 |

## GitHub

| Purpose | Details |
|---------|---------|
| **SSH key** | `~/.ssh/github_marko` (MarkoKCOM account) |
| **gh CLI** | `marciano147` PAT (active), `MarkoKCOM` PAT (switch with `gh auth switch`) |
| **OpenSeat repo** | `MarkoKCOM/Restaurant-Agent` |
| **Hermes repo** | `MarkoKCOM/Hermes-Agent` |

## AI / Models

| Purpose | Provider | Model |
|---------|----------|-------|
| **Hermes agent (customer-facing)** | OpenAI Codex (OAuth) | `gpt-5.4` |
| **Hermes fallback** | Anthropic (OAuth) | Claude via Claude Code |
| **OpenSeat API agent** | OpenRouter | `google/gemini-2.5-flash` (configurable via `AGENT_MODEL`) |
| **Dashboard help chat** | OpenRouter | `qwen/qwen3-coder:free` (configurable via `CHAT_MODEL`) |
| **Coding delegation** | Anthropic | Claude Code (via Hermes) |

## Telegram

| What | ID |
|------|-----|
| **OpenSeat group** | `-1003691973621` |
| **Topic: General** (customer-facing) | Thread 1 |
| **Topic: BFF Owner** (notifications) | Thread 17 |
| **Topic: Reports** (cron output) | Thread 20 |
| **Sione (DM)** | `2090199766` |

## Database

```bash
# Connect
psql -U openseat openseat_db

# Migrations
pnpm db:generate    # Create migration from schema changes
pnpm db:migrate     # Apply pending migrations
pnpm db:seed        # Seed BFF Ra'anana data
```

## Vercel Deployments

| App | Project |
|-----|---------|
| Dashboard | Linked in `apps/dashboard/.vercel/` |
| Booking Widget | Linked in `apps/booking-widget/.vercel/` |
| Marketing Site | Linked in `apps/marketing-site/.vercel/` |

Deploy with: `vercel --token $(cat ~/.vercel-token)`

## Hermes Skills (OpenSeat-specific)

Located in `/root/.hermes/skills/`:

| Skill | Purpose |
|-------|---------|
| `development/openseat-api-verification` | API endpoint testing |
| `development/openseat-membership-tooling` | Membership/loyalty backend |
| `development/openseat-reservation-ops` | Reservation lifecycle ops |
| `development/openseat-role-access-changes` | Role-based access changes |
| `openclaw-imports/openseat-agent` | Customer-facing agent skill |
| `openclaw-imports/openseat-openspec` | OpenSpec planning workflow |
| `openclaw-imports/jake-env-auth` | Auth/path clarity |
| `software-development/openseat-admin-user-provisioning` | Admin user seeding |
| `goal-based-execution` | Reliable task completion rules |
