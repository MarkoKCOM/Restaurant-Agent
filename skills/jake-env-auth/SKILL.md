---
name: jake-env-auth
description: Jake's environment, auth profiles, env variables, and model configuration — load this to avoid losing context on where things are.
tags: [env, auth, restaurant, jake]
category: environment
---

# Jake Environment & Auth — Ground Truth

> **Load this skill** at session start or whenever you're unsure about environment variables, auth tokens, or model configuration. This is YOUR cheat sheet — don't guess, read this.

## Your Identity

- **Agent ID:** `restaurant`
- **Name:** Jake 🍽️
- **Primary model:** `openai-codex/gpt-5.1`
- **Fallback model:** `openai-codex/gpt-5.4` (for heavy coding)

## Critical Paths

| What | Path |
|------|------|
| **Your workspace** | `/root/.openclaw/agents/restaurant/workspace/` |
| **Your agent dir** | `/root/.openclaw/agents/restaurant/agent/` |
| **Your auth profiles** | `/root/.openclaw/agents/restaurant/agent/auth-profiles.json` |
| **Global env vars** | `/root/.openclaw/.env` |
| **OpenClaw config** | `/root/.openclaw/openclaw.json` |
| **Your repo** | `/root/.openclaw/agents/restaurant/workspace/repo/` |
| **Shared skills** | `/root/.openclaw/workspace/skills/` |
| **Your skills** | `/root/.openclaw/agents/restaurant/workspace/skills/` |

## Auth Profiles (YOUR file, not Marko's)

Your OAuth tokens are in **`/root/.openclaw/agents/restaurant/agent/auth-profiles.json`**.

⚠️ **NOT** `/root/.openclaw/agents/main/agent/auth-profiles.json` — that's Marko's. Yours is under `agents/restaurant/`.

You have two profiles:
1. **`anthropic:default`** — Anthropic token (backup, not your primary model)
2. **`openai-codex:default`** — Your primary model auth. OAuth token, ~10 day lifetime, auto-refreshed.

## OpenAI Codex Token Refresh

When your model calls fail with 401 or expired token:

```bash
# Try silent refresh first (no user needed)
python3 /root/.openclaw/workspace/skills/openai-codex-auth/refresh.py

# If that fails, generate auth URL for Sione
python3 /root/.openclaw/workspace/skills/openai-codex-auth/refresh.py --full
```

**Important:** The refresh script targets the MAIN agent's auth-profiles by default. For YOUR tokens, check that the script is updating the right file, or manually copy the refreshed tokens to your auth-profiles.json.

### Heartbeat Token Check

During heartbeats, check your token expiry:
```bash
python3 -c "
import json, time
with open('/root/.openclaw/agents/restaurant/agent/auth-profiles.json') as f:
    data = json.load(f)
profile = data.get('profiles', {}).get('openai-codex:default', {})
expires = profile.get('expires', 0)
remaining = (expires - time.time() * 1000) / (1000 * 3600 * 24)
print(f'Token expires in {remaining:.1f} days')
if remaining < 2:
    print('⚠️ TOKEN EXPIRING SOON — refresh needed!')
"
```

## Environment Variables

All env vars live in **`/root/.openclaw/.env`** — this is the SINGLE source of truth. Never store secrets in workspace files or code.

Key vars available to you:

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot auth |
| `GH_TOKEN` | GitHub API (read) |
| `MARKO_GH_PAT` | GitHub bot account (MarkoKCOM) |
| `BRAVE_API_KEY` | Web search |
| `GROQ_API_KEY` | Voice/audio |
| `GEMINI_API_KEY` | Memory search |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Workspace service account |

To check what's available:
```bash
grep -oP '^[A-Z_]+=' /root/.openclaw/.env | sort
```

**Never** `cat` or `echo` the .env file contents. Only read variable names, not values.

## Telegram

| Setting | Value |
|---------|-------|
| Bot | `@intern_kcom_v2_bot` |
| Restaurant group | `-1003550104950` |
| Your topic | `273` |
| Sione's ID (paired) | `2090199766` |

## Common Mistakes to Avoid

1. **Don't confuse your auth-profiles with Marko's** — yours is under `agents/restaurant/`, not `agents/main/`
2. **Don't hardcode env var values** — always reference from `.env`
3. **Don't store secrets in workspace files** — `.env` only
4. **Don't restart openclaw-gateway** without asking Sione
5. **When token expires, refresh first** — don't immediately ask Sione for re-auth. The refresh script handles it silently 90% of the time.
6. **GitHub pushes** use SSH key `/root/.ssh/github_marko` (MarkoKCOM bot account)
