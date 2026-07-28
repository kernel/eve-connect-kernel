---
name: kernel-auth
description: Authenticate to a website with Kernel managed auth — set up a connection, run the human-in-the-loop hosted login, reuse the authenticated profile, and troubleshoot re-authentication. Use whenever a task requires signing into or acting on an authenticated site (Gmail, GitHub, a dashboard, any domain behind a login).
---

# Authenticating a website with Kernel managed auth

Kernel manages logins for you: a **profile** stores durable login state, a **managed auth connection** keeps a *profile + domain* signed in and re-authenticates on its own, and a browser created on that profile starts already logged in. The human signs in once through a hosted flow — you never type raw credentials into a page.

> This is the eve/MCP version of Kernel's [`kernel-auth` skill](https://www.skills.sh/kernel/skills/kernel-auth) (source: [github.com/kernel/skills](https://github.com/kernel/skills)). That one drives the `kernel` CLI; here you use the extension's `manage_auth_connections`, `manage_profiles`, and `manage_browsers` tools. See Kernel's [managed auth docs](https://www.kernel.sh/docs) for the canonical reference.

## 1. Reuse an existing login first

Before setting anything up, check for a connection that's already authenticated for the domain:

- `manage_auth_connections` (`action: "list"`, `domain_filter: "<domain>"`). If one is `AUTHENTICATED`, skip to **step 5** and open a browser on its `profile_name` — you're already logged in.
- If a connection exists but is `NEEDS_AUTH` (never completed, or the login session expired), keep the connection and jump to **step 4** to start a fresh login. Don't create a duplicate.

## 2. Pick the profile

Default to a **new** profile unless the user names one to reuse. Name it after the person who asked plus a date stamp — `<user>_<MMYYYY>`, e.g. `alex_072026` — so profiles don't collide across people or days. Create it with `manage_profiles` (`action: "setup"`); pass `update_existing: true` only when deliberately reusing a named profile.

## 3. Create the connection

`manage_auth_connections` (`action: "create"`) with:

- `profile_name` — from step 2.
- `domain` — the target site, e.g. `github.com`.
- `login_url` *(optional)* — the sign-in page, if you already know it (skips discovery).
- `allowed_domains` *(optional)* — extra domains the flow is allowed to touch. Common SSO providers (Google, Microsoft, Okta, Auth0, Apple, GitHub, Facebook, LinkedIn, Cognito, OneLogin, Ping) are allowed automatically; add this only for a site's non-standard redirect domain.
- `proxy_id` *(optional, preferred)* or `proxy_name` — route the auth flow through a proxy. Prefer `proxy_id` for a stable, unambiguous reference.
- **Credentials (for unattended login).** Pass a stored Kernel credential so Kernel can log in without a human: `credential_name`, **or** `credential_provider` with either `credential_auto: true` (provider looks the item up by domain) or `credential_path` (a specific item). Use `credential_name` *or* `credential_provider`, not both. Leave all of these unset for a **human hosted login** (the default, and the right call when you don't hold the credentials).
- `save_credentials` *(default `true`)* — keep this on so a successful login is saved and the connection can re-authenticate unattended later. Setting it `false` usually blocks unattended re-auth.
- `health_check_interval` *(optional)* — seconds between automatic re-auth checks. Health checks and auto re-auth are on by default server-side; the interval defaults to about an hour, the minimum is plan-dependent, and the max is `86400`.

A connection's `domain` and `profile_name` are fixed at creation and there's no `update` action here — to change either, create a new connection.

## 4. Run the hosted login (human in the loop)

The default. The person does everything in Kernel's hosted browser — you never handle their credentials or MFA codes:

1. `manage_auth_connections` (`action: "login"`, `id: <connection id>`) → returns a **`hosted_url`**, a **`live_view_url`**, and an expiry for the flow.
2. Hand the `hosted_url` to the user with `ask_question` — ask them to sign in and clear any MFA/SSO there, and to reply when they're done. Share the `live_view_url` so they can watch or take over. `ask_question` pauses the turn until they answer, so don't poll in the meantime — just wait.
3. When they reply, call `manage_auth_connections` (`action: "get"`, `id`) once to confirm the connection reads `AUTHENTICATED`. If it doesn't (they hit a snag, or the login flow expired), just start a fresh `login` to supersede the stale flow and hand over the new URL — **don't** delete the connection or profile to "reset."

Never ask the user to paste a password or MFA code into the chat — that's exactly what the hosted flow exists to avoid.

**Credential-based (unattended) login.** Only when you set the connection up with a stored credential (step 3) — here you drive it yourself, no `ask_question`: poll `manage_auth_connections` (`action: "get"`, `id`), and when it's **awaiting input**, read `discovered_fields` / `mfa_options` and call `manage_auth_connections` (`action: "submit"`, `id`, e.g. `fields: { mfa_code: "123456" }`, `mfa_option_id`, or `sso_button_selector`). A successful `submit` only means the input was accepted for processing — not that login is done. Keep polling `get` until the connection reads `AUTHENTICATED`; repeat submits as new input is requested.

## 5. Use the authenticated profile

`manage_browsers` (`action: "create"`) with `profile_name` set (`stealth: true` for real sites, `timeout_seconds` of at least `600` so a hosted-login or hand-off wait doesn't expire the session). It starts already signed in. **Don't set `save_profile_changes`** — managed auth owns the profile's login state, so the task session reads from it but shouldn't write back over it. Confirm you're actually in (read the page); if you hit a login wall, the connection needs re-auth — run step 4 again, then retry.

## Staying logged in

The connection re-authenticates on its own on its `health_check_interval`, so future runs start authenticated without a human. You only re-run the hosted login (step 4) when a connection goes `NEEDS_AUTH` and can't recover — e.g. the site forced a full re-login. The profile and connection persist across sessions; deleting a browser doesn't remove them.

Don't judge re-auth readiness from status alone. Read the connection with `manage_auth_connections` (`action: "get"`, `id`) and check the re-auth fields it reports (whether it can re-auth, and the reason if it can't). A connection can read `AUTHENTICATED` yet still be unable to re-auth unattended — e.g. it was created with `save_credentials: false`, has no stored credential, or the site now needs a fresh human step. When the reason is a blocker only a person can clear, run step 4 rather than looping on `login`.

## Cleanup

- Delete temporary browser sessions when done with `manage_browsers` (`action: "delete"`). This never touches the profile or connection.
- To remove a single connection without disturbing the profile, use `manage_auth_connections` (`action: "delete"`, `id`).
- Deleting a **profile** (`manage_profiles`, `action: "delete"`) cascades — it removes every connection attached to it. Prefer re-running the hosted login over deleting and recreating.

## Safety

- Never type raw credentials into a page — always go through the hosted flow or pre-stored Kernel credentials.
- Don't read back, log, or exfiltrate credential values or MFA secrets.
- Confirm with the user before any sensitive or irreversible action taken while signed in (a purchase, a send, a delete).
