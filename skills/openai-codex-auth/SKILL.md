---
name: openai-codex-auth
description: Guide for refreshing OpenAI Codex OAuth tokens on the VPS — refresh-first flow with PKCE fallback for headless VPS.
---

# OpenAI Codex Auth — Token Refresh Guide

> **Use this skill** when `openai-codex` model calls fail with 401/expired token, or when the token is approaching expiry (~10 day lifetime).

## Quick Facts

| Item | Value |
|------|-------|
| Provider | `openai-codex` |
| Auth type | OAuth 2.0 + PKCE (S256) |
| Client ID | `app_EMoamEEZ73f0CkXaXp7hrann` |
| Token lifetime | ~10 days |
| Auth profiles file | `/root/.openclaw/agents/main/agent/auth-profiles.json` |
| Account | `admin@kaspa.com` (Google OAuth) |
| Refresh script | `skills/openai-codex-auth/refresh.py` |

## Quick Refresh (No User Needed)

```bash
python3 /root/.openclaw/workspace/skills/openai-codex-auth/refresh.py
```

This tries the stored `refresh_token` first. If it works, done — new token saved, no user interaction needed. If the refresh token is dead (already used by another process), it falls back to full OAuth and prints a URL for Sione.

## Script Usage

```bash
# Auto: refresh first, fall back to full auth URL if needed
python3 refresh.py

# Force full OAuth (skip refresh attempt)
python3 refresh.py --full

# Exchange an auth code after user signed in
python3 refresh.py --exchange '<redirect_url_or_code>'
```

## How It Works

### Refresh Flow (automatic, no user needed)
1. Script reads `refresh_token` from auth-profiles.json
2. POSTs to `https://auth.openai.com/oauth/token` with `grant_type=refresh_token`
3. Gets new `access_token` + rotated `refresh_token`
4. Saves both to auth-profiles.json
5. Done — ~2 seconds, no browser needed

### Full Auth Flow (only if refresh fails)
1. Script generates PKCE `code_verifier` + `code_challenge`, saves to `/tmp/openai-pkce.json`
2. Prints OAuth URL — send to Sione to open in browser
3. Sione signs in with `admin@kaspa.com` (Google OAuth)
4. Browser redirects to `localhost:1455/auth/callback?code=...` (won't load — copy full URL)
5. Run `python3 refresh.py --exchange '<redirect_url>'` to exchange code for token

## Why Not `openclaw models auth login`?

The built-in command requires an interactive TTY. On this headless VPS, `script` and `expect` workarounds fail because openclaw uses TUI prompts with ANSI escape codes.

## Heartbeat Integration

The heartbeat checks token expiry every 2-3 hours. When expiry is within 2 days:
1. First: runs `refresh.py` to try silent refresh
2. If refresh fails: DMs Sione with the auth URL

## Key Rules

- **Refresh tokens are single-use** — each refresh rotates the token. If two processes race, one gets "refresh_token_reused" and needs full re-auth.
- **The `openai-codex:chatgpt` profile is legacy** — ignore it, only `openai-codex:default` matters.
- **Token expires ~10 days** after issue. Refresh extends by another ~10 days.
- **Continuous refresh = no user interaction needed** as long as the refresh token isn't consumed by a race condition.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `refresh_token_reused` | Another process already refreshed. Run `python3 refresh.py --full` and send URL to Sione. |
| `401` on model calls | Token expired + refresh dead. Full re-auth. |
| `invalid_grant` | Auth code expired or already used. Generate new URL with `--full`. |
| Token works but model errors | Check OpenAI Plus plan limits / codex quota. |
