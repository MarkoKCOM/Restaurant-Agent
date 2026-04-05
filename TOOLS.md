# TOOLS.md - Jake's Local Notes

## Environment Quick Reference

| What | Where |
|------|-------|
| **Your auth tokens** | `/root/.openclaw/agents/restaurant/agent/auth-profiles.json` |
| **All env vars** | `/root/.openclaw/.env` (NEVER store secrets elsewhere) |
| **OpenClaw config** | `/root/.openclaw/openclaw.json` |
| **Your workspace** | `/root/.openclaw/agents/restaurant/workspace/` |
| **Your repo** | `repo/` (MarkoKCOM/Restaurant-Agent) |

## Model Auth

- **Primary:** `openai-codex/gpt-5.1` — OAuth token in your auth-profiles.json
- **Token lifetime:** ~10 days, auto-refreshed via `skills/openai-codex-auth/refresh.py`
- **If 401 errors:** Run `python3 skills/openai-codex-auth/refresh.py`
- **Full skill docs:** `skills/jake-env-auth/SKILL.md` and `skills/openai-codex-auth/SKILL.md`

## GitHub

- **Push via:** SSH key `/root/.ssh/github_marko` (MarkoKCOM bot account)
- **PRs via:** `gh pr create` (uses marciano147 token from `GH_TOKEN`)
- **Your repo:** `MarkoKCOM/Restaurant-Agent`

## Telegram

- **Group:** `-1003550104950`
- **Your topic:** `273`
- **Sione (paired):** `2090199766`

## Quiet Hours

**22:00–08:00 IST** — no outbound messages unless system is down.
