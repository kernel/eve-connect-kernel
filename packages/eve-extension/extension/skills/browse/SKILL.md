---
name: browse
description: Drive a Kernel cloud browser end-to-end to solve a web task — open a browser, read the page, take the single best next action, observe, and repeat until done. Use whenever a task requires navigating, reading, or acting on a website.
---

# Autonomous browser agent

Given a task, work it end-to-end in a real browser: open a page, look at it, decide the next move, act, observe the result, and keep going until the task is done. Drive the whole thing yourself — do not check in after every action.

Your browser tools come from the **Kernel** connection — find them with `connection_search`: `kernel__manage_browsers`, `kernel__execute_playwright_code`, `kernel__computer_action`, `kernel__browser_curl`, and — for logins — `kernel__manage_auth_connections` and `kernel__manage_credentials`. Always drive the browser through Kernel.

## How you work

1. **Open a browser.** Call `manage_browsers` with `action: "create"` (use `stealth: true` for real sites, and set `timeout_seconds` to at least `3600`). Keep the returned `session_id` — every other Kernel call needs it. Pass a `start_url` when you already know where to begin.
2. **Look.** Read the current page with `execute_playwright_code`, e.g. `return { url: page.url(), snapshot: await page.locator('body').ariaSnapshot() };`. Use `computer_action` with a `screenshot` action when you need to see the page visually.
3. **Decide and act.** Pick the single next move that gets you closest to the goal and do it — navigate, click, type, extract — with `execute_playwright_code` or `computer_action` (always pass the `session_id`). `execute_playwright_code` is best for precise, deterministic steps (selectors, form fills, reading data); `computer_action` is best for visual, coordinate-based interaction and screenshots. Use `browser_curl` to hit an API or fetch a resource directly through the browser session's network stack when you don't need to render a page.
4. **Observe and repeat.** Read the new page and loop back to step 3. Keep iterating on your own until the task is solved — that may take many steps.
5. **Report.** When the task is done — or you've concluded you can't complete it — report the outcome: what you accomplished, the data you extracted, and any evidence (final URL, key page content). Include the live view URL so the user can inspect the result or take over. Leave the browser open (see "Ending the session") so a follow-up request can continue right where you left off.

## Stopping

- Work efficiently. If a step fails, don't repeat it the same way — change your approach. If you're clearly making no progress, stop and report where you got, what's blocking you, and what you'd try next rather than looping.
- Ask the human only when you're genuinely blocked and can't proceed alone — a required login/credentials, a captcha you can't clear, or a task that's too ambiguous to act on. Use `ask_question` for this, then continue once they respond. Reserve it for real blockers, not routine decisions you can make yourself.

## Rules

- Reuse the same browser — pass the `session_id` from step 1 to every `execute_playwright_code` and `computer_action` call. Never open a second browser; if you've lost the id, recover it with `manage_browsers` (`action: "list"`).
- Work from what's actually on the page, not from memory. Re-read the page after any action that changes it before deciding the next move.
- Be careful with irreversible actions (purchases, sends, deletions). Only take them when the task clearly calls for it, and confirm with the user first if there's any doubt.

## Logins

When a site needs a sign-in, default to Kernel's **managed auth** — don't type raw credentials into the page yourself.

1. Check `manage_auth_connections` for an existing connection for that domain and reuse it if it's authenticated.
2. Otherwise start a login flow with `manage_auth_connections`. It can authenticate from stored credentials (`manage_credentials`, including TOTP for MFA), or it returns a hosted login URL and live view for the user to sign in and clear MFA/SSO. Share that URL and wait for them to finish, then continue.
3. Fall back to asking the user to sign in through the browser's own live view URL only when managed auth isn't available for the site.

## Ending the session

- Do **not** delete the browser when a task finishes — keep it open so the user can send a follow-up that continues in the same session.
- Delete it with `manage_browsers` (`action: "delete"`) only when the user explicitly asks to end the session (or start fresh). Otherwise leave it: it expires on its own once it hits the inactivity `timeout_seconds` you set when you created it.
