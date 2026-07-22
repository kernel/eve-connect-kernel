---
name: kernel-auth
description: Authenticate to a website with Kernel managed auth — set up a connection, run the human-in-the-loop hosted login, and reuse the authenticated profile. Use whenever a task requires signing into or acting on an authenticated site (Gmail, GitHub, a dashboard, any domain behind a login).
---

# Authenticating a website with Kernel managed auth

Kernel manages logins for you: a **profile** stores durable login state, a **managed auth connection** keeps a *profile + domain* signed in and re-authenticates on its own, and a browser created on that profile starts already logged in. The human signs in once through a hosted flow — you never type raw credentials into a page.

> This is the eve/MCP version of Kernel's [`kernel-auth` skill](https://www.skills.sh/kernel/skills/kernel-auth) (source: [github.com/kernel/skills](https://github.com/kernel/skills)). That one drives the `kernel` CLI; here you use the extension's `manage_auth_connections`, `manage_profiles`, and `manage_browsers` tools. See Kernel's [managed auth docs](https://www.kernel.sh/docs) for the canonical reference.

## 1. Reuse an existing login first

Before setting anything up, check for a connection that's already authenticated for the domain:

- `manage_auth_connections` (`action: "list"`, `domain_filter: "<domain>"`). If one is `AUTHENTICATED`, skip to **step 5** and open a browser on its `profile_name` — you're already logged in.
- If a connection exists but is `NEEDS_AUTH` (never completed, or the login session expired), keep the connection and jump to **step 4** to start a fresh login. Don't create a duplicate.

## 2. Pick the profile

Default to a **new** profile unless the user names one to reuse. Name it after the person who asked plus a date stamp — `<user>_<MMYYYY>`, e.g. `danny_072026` — so profiles don't collide across people or days. Create it with `manage_profiles` (`action: "setup"`); pass `update_existing: true` only when deliberately reusing a named profile.

## 3. Create the connection

`manage_auth_connections` (`action: "create"`) with:

- `profile_name` — from step 2.
- `domain` — the target site, e.g. `github.com`.
- `login_url` *(optional)* — the sign-in page, if you already know it (skips discovery).
- For an **unattended** login from credentials a human pre-stored in Kernel, pass `credential_name` (or `credential_provider` + `credential_path`, or `credential_auto: true`). Leave these unset for a **human hosted login** (the default, and the right call when you don't hold the credentials).

## 4. Run the hosted login (human in the loop)

1. `manage_auth_connections` (`action: "login"`, `id: <connection id>`) → returns a **`hosted_url`** and a **`live_view_url`**.
2. Hand the `hosted_url` to the user with `ask_question` — ask them to sign in and clear any MFA/SSO there. Share the `live_view_url` so they can watch or take over. Then wait.
3. Poll `manage_auth_connections` (`action: "get"`, `id`). If it's **awaiting input**, read `discovered_fields` / `mfa_options` and `submit` what's needed (e.g. `fields: { mfa_code: "123456" }`, or `mfa_option_id`); otherwise keep waiting for the human. Continue until the connection reports `AUTHENTICATED`.

The login session (the hosted URL) expires after a while if unused — if it does, just start a new one with `login`; the connection itself stays.

## 5. Use the authenticated profile

`manage_browsers` (`action: "create"`) with `profile_name` set (`stealth: true` for real sites, `timeout_seconds` of at least `600` so a hosted-login or hand-off wait doesn't expire the session). It starts already signed in. **Don't set `save_profile_changes`** — managed auth owns the profile's login state, so the task session reads from it but shouldn't write back over it. Confirm you're actually in (read the page); if you hit a login wall, the connection needs re-auth — run step 4 again, then retry.

## Staying logged in

The connection re-authenticates on its own on a `health_check_interval`, so future runs start authenticated without a human. You only re-run the hosted login (step 4) when a connection goes `NEEDS_AUTH` and can't recover — e.g. the site forced a full re-login. The profile and connection persist across sessions; deleting a browser doesn't remove them.

## Safety

- Never type raw credentials into a page — always go through the hosted flow or pre-stored Kernel credentials.
- Don't read back, log, or exfiltrate credential values or MFA secrets.
- Confirm with the user before any sensitive or irreversible action taken while signed in (a purchase, a send, a delete).
