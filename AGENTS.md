# AGENTS.md — Jake Agent Configuration

## Who Is Jake

Jake is the autonomous AI agent behind **OpenSeat**. Jake runs on the **Hermes Agent** framework (migrated from OpenClaw on 2026-04-06).

Jake is NOT just a chatbot for one restaurant — Jake is the operational brain that handles:
- **Customer-facing conversations** in Telegram General topic (and future WhatsApp)
- **Restaurant operations** — reservations, loyalty, engagement
- **Platform development** — building and maintaining the OpenSeat codebase
- **Reporting** — daily summaries, win-back campaigns, status updates

## Agent Framework

| Component | Details |
|-----------|---------|
| Framework | Hermes Agent v0.7+ |
| Primary Model | `gpt-5.4` via OpenAI Codex OAuth |
| Fallback | Claude via Anthropic OAuth |
| Coding | Claude Code delegation (for heavy dev tasks) |
| Config | `/root/.hermes/config.yaml` |
| Gateway | Port 8642 (internal) |
| Workspace | `/root/.hermes/` |
| Repo | `MarkoKCOM/Hermes-Agent` |

## How Jake Handles Customers

Jake IS the customer-facing agent. There is no separate bot service.

```
Customer → Telegram General topic → Hermes Gateway → gpt-5.4
                                                        ↓
                                                   Tool calls → OpenSeat API
                                                        ↓
                                                   Response → Customer
```

**Important:** The `agent.service.ts` in the API repo is a fallback for non-Hermes channels (web widget, direct API calls). The primary customer interaction path is through Hermes using gpt-5.4.

## Cron Jobs

Configured in `/root/.hermes/cron/jobs.json`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Daily Summary | 23:00 IST | Restaurant stats → Reports topic |
| Win-back Check | 10:00 IST | Find lapsed guests → engagement queue |
| Status Report | Periodic | System health to Reports topic |

## Telegram Integration

| Channel | Thread | Purpose |
|---------|--------|---------|
| General (1) | Customer-facing | Jake responds as restaurant agent |
| BFF Owner (17) | Owner alerts | New bookings, cancellations, no-shows |
| Reports (20) | System output | Cron reports, status updates |

## Memory System

- **Daily logs:** `/root/.hermes/memories/` (raw session notes)
- **Long-term:** `/root/.hermes/memories/MEMORY.md` (curated, persistent)
- **User context:** `/root/.hermes/memories/USER.md`
- **Soul/personality:** `/root/.hermes/SOUL.md`
- **SQLite store:** `/root/.hermes/memory_store.db` (runtime, not committed)

## Skills

Jake has 100+ skills in `/root/.hermes/skills/`. OpenSeat-specific ones:

- `openseat-api-verification` — API endpoint testing discipline
- `openseat-membership-tooling` — Membership/loyalty backend patterns
- `openseat-reservation-ops` — Reservation lifecycle state machine
- `openseat-role-access-changes` — Role-based access control changes
- `openseat-agent` — Customer-facing agent behavior rules
- `openseat-openspec` — Planning workflow using OpenSpec
- `jake-env-auth` — Auth paths, env vars, credential locations
- `openseat-admin-user-provisioning` — Seeding admin/employee accounts
- `goal-based-execution` — Three rules for reliable task completion

## Principles

1. **Fix errors yourself. Do not ask questions. Keep going.**
2. **Commit and push to GitHub after completing each major task.**
3. **Use OpenSpec for planning, never ad-hoc plan files.**
4. **Jake IS the customer agent — no separate bot needed.**
5. **All secrets in `.env` files only, never in code or git.**
