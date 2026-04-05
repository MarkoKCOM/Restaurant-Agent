#!/usr/bin/env python3
"""
OpenAI Codex token refresh — tries refresh_token first, falls back to full PKCE auth.

Usage:
  python3 refresh.py                  # Refresh using stored refresh_token
  python3 refresh.py --full           # Force full OAuth (generates URL)
  python3 refresh.py --exchange URL   # Exchange auth code from redirect URL
"""
import hashlib, base64, os, json, sys, time, urllib.request, urllib.parse

CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
REDIRECT_URI = "http://localhost:1455/auth/callback"
TOKEN_URL = "https://auth.openai.com/oauth/token"
AUTH_URL = "https://auth.openai.com/oauth/authorize"
AGENTS_DIR = "/root/.openclaw/agents"
AUTH_PROFILES = f"{AGENTS_DIR}/main/agent/auth-profiles.json"
PKCE_FILE = "/tmp/openai-pkce.json"
PROFILE_KEY = "openai-codex:default"


def load_profiles():
    with open(AUTH_PROFILES) as f:
        return json.load(f)


def save_token(profiles, result):
    expires_ms = int(time.time() * 1000) + result.get("expires_in", 864000) * 1000
    profiles["profiles"][PROFILE_KEY] = {
        "type": "oauth",
        "provider": "openai-codex",
        "access": result["access_token"],
        "refresh": result.get("refresh_token", ""),
        "expires": expires_ms,
    }
    profiles["lastGood"]["openai-codex"] = PROFILE_KEY
    with open(AUTH_PROFILES, "w") as f:
        json.dump(profiles, f, indent=2)
    from datetime import datetime
    exp = datetime.fromtimestamp(expires_ms / 1000)
    print(f"Token saved. Expires: {exp}")
    propagate_to_subagents(profiles)
    return True


def propagate_to_subagents(main_profiles):
    """Copy the refreshed Codex token to all subagent auth-profiles."""
    import copy
    main_codex = main_profiles["profiles"].get(PROFILE_KEY)
    if not main_codex:
        return
    main_chatgpt = main_profiles["profiles"].get("openai-codex:chatgpt")
    synced = []
    for agent in sorted(os.listdir(AGENTS_DIR)):
        if agent == "main":
            continue
        path = f"{AGENTS_DIR}/{agent}/agent/auth-profiles.json"
        if not os.path.exists(path):
            continue
        with open(path) as f:
            d = json.load(f)
        if "profiles" not in d:
            d["profiles"] = {}
        d["profiles"][PROFILE_KEY] = copy.deepcopy(main_codex)
        if main_chatgpt:
            d["profiles"]["openai-codex:chatgpt"] = copy.deepcopy(main_chatgpt)
        if "lastGood" not in d:
            d["lastGood"] = {}
        d["lastGood"]["openai-codex"] = PROFILE_KEY
        with open(path, "w") as f:
            json.dump(d, f, indent=2)
        synced.append(agent)
    if synced:
        print(f"Propagated to {len(synced)} subagents: {', '.join(synced)}")


def do_refresh(profiles):
    """Try to refresh using stored refresh_token."""
    profile = profiles["profiles"].get(PROFILE_KEY, {})
    refresh_token = profile.get("refresh")
    if not refresh_token:
        print("No refresh token found.")
        return False

    data = json.dumps({
        "grant_type": "refresh_token",
        "client_id": CLIENT_ID,
        "refresh_token": refresh_token,
    }).encode()

    req = urllib.request.Request(TOKEN_URL, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print("Refresh successful!")
        return save_token(profiles, result)
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        msg = err.get("error", {}).get("message", str(err))
        print(f"Refresh failed: {msg}")
        return False


def do_full_auth():
    """Generate a PKCE OAuth URL for full re-auth."""
    verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    state = os.urandom(16).hex()

    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "openid profile email offline_access",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "id_token_add_organizations": "true",
        "codex_cli_simplified_flow": "true",
        "originator": "pi",
    }
    url = AUTH_URL + "?" + urllib.parse.urlencode(params)

    with open(PKCE_FILE, "w") as f:
        json.dump({"verifier": verifier, "state": state}, f)

    print(f"\nOpen this URL in your browser:\n\n{url}\n")
    print(f"After signing in, run:\n  python3 {__file__} --exchange '<redirect_url>'")


def do_exchange(redirect_url):
    """Exchange an auth code for a token using saved PKCE verifier."""
    with open(PKCE_FILE) as f:
        pkce = json.load(f)

    if "code=" in redirect_url:
        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(redirect_url).query)
        code = parsed["code"][0]
    else:
        code = redirect_url

    data = json.dumps({
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": pkce["verifier"],
    }).encode()

    req = urllib.request.Request(TOKEN_URL, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        profiles = load_profiles()
        print("Exchange successful!")
        save_token(profiles, result)
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print(f"Exchange failed: {json.dumps(err, indent=2)}")
        sys.exit(1)


def main():
    if "--exchange" in sys.argv:
        idx = sys.argv.index("--exchange")
        url = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else input("Paste redirect URL: ")
        do_exchange(url)
        return

    if "--full" in sys.argv:
        do_full_auth()
        return

    # Default: try refresh first, then fall back to full auth
    profiles = load_profiles()
    if do_refresh(profiles):
        return

    print("\nFalling back to full OAuth flow...")
    do_full_auth()


if __name__ == "__main__":
    main()
