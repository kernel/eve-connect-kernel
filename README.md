# eve-browser-agent

A [Vercel eve](https://vercel.com/eve) agent that solves web tasks autonomously in a [Kernel](https://www.kernel.sh) cloud browser. Give it a goal — "find the cheapest direct flight from JFK to SFO next Friday", "sign up for this newsletter", "pull the pricing tiers off this site" — and it opens a browser, reads the page, decides the next move, acts, observes the result, and keeps iterating on its own until the task is done. It only stops to ask you when it's genuinely blocked (a login it can't complete, a captcha, an ambiguous instruction).

The browser tools aren't built here. They come from the **[`@onkernel/eve-extension`](https://github.com/kernel/eve-extension)** package: mount it in one line and every browser tool — session management, Playwright execution, and human-like computer controls — plus a `browse` skill show up automatically. No custom tool code to write or maintain.

## How it works

eve loads any file under `agent/extensions/` as an extension. `agent/extensions/kernel.ts` mounts `@onkernel/eve-extension`, which packages a single MCP connection to Kernel's hosted server; eve discovers Kernel's tools at runtime and exposes them to the model as `kernel__browser__<tool>` via its `connection_search` tool. The ones the agent uses:

- **`manage_browsers`** — create, list, get, and delete browser sessions. Returns a `session_id` and a `live_view_url` you can watch or take over.
- **`execute_playwright_code`** — run Playwright against the live page to read, navigate, click, or type. Best for precise, deterministic steps.
- **`computer_action`** — human-like mouse, keyboard, and screenshot controls for the same session. Best for visual, coordinate-based interaction.
- **`manage_auth_connections`** — Kernel's managed auth. When a site needs a login, the agent authenticates through it (reusing a stored connection, or launching a hosted login flow for the user to complete) instead of typing credentials into the page.
- the **`browse`** skill — the read → act → observe loop the model follows to drive the browser end-to-end.

The extension also ships `manage_profiles` (persistent cookies/logins) and `manage_proxies` (geo-targeted proxies) in the default mount. Higher-blast-radius tools — `browser_curl`, `manage_credentials`, `exec_command`, `manage_browser_pools` — are off by default to keep an autonomous agent's blast radius small; add them (and any approval gate) with a [connection override](#optional-widen-the-toolset-or-add-an-approval-gate).

The agent loop lives in [`agent/instructions.md`](agent/instructions.md): open a browser, read the page, take the single best next action, re-read, and repeat — carrying the `session_id` across steps. It runs this loop itself and reports the outcome (with any extracted data and the live view URL) when it finishes or gets stuck. eve runs that whole read → act → observe loop inside one durable turn, so a single request can drive the browser through many steps. It leaves the browser session open after a task so a follow-up request continues in the same browser; the session is deleted only when you ask it to end, or it expires on its own inactivity timeout.

There's no approval gate on the connection — the agent acts on its own. To pause for a human before irreversible actions (a purchase, send, or delete), add an `approval` policy to the connection; see [Approval gates](#optional-add-an-approval-gate) below.

```
agent/
  agent.ts               # model (routed through the Vercel AI Gateway)
  instructions.md        # the read -> act -> observe loop and stop conditions
  extensions/kernel.ts   # mounts @onkernel/eve-extension — provides the browser tools
  channels/eve.ts        # default HTTP channel, locked to loopback
  channels/slack.ts      # Slack channel — streams progress and renders any prompts as buttons
```

## Authentication

The browser connection authenticates through **[Vercel Connect](https://vercel.com/connect)** — no API key touches your app, env, or the model, and each user authenticates as themselves with a one-time consent that's cached afterward. The mount passes the Connect connector UID:

```ts
// agent/extensions/kernel.ts
import kernel from "@onkernel/eve-extension";

export default kernel({ connect: "mcp.onkernel.com/eve-extension" });
```

Create the connector once (name it `eve-extension` so the snippet above works unedited):

```bash
vercel connect create mcp.onkernel.com --name eve-extension
vercel connect attach mcp.onkernel.com/eve-extension
```

(or add it from the Vercel dashboard → Connectors → "Browse all" → Kernel; confirm the UID with `vercel connect list`). Leave `KERNEL_API_KEY` unset — the first time a user drives the browser, eve surfaces a Connect consent prompt they approve once, and the grant persists across threads and sessions. Each user acts as themselves, a good fit for Kernel's per-user managed auth.

Prefer a single shared key instead? Mount `export { default } from "@onkernel/eve-extension";` and set `KERNEL_API_KEY` in the environment. See the [extension README](https://github.com/kernel/eve-extension) for the API-key path.

## Optional: widen the toolset or add an approval gate

The agent runs autonomously with the extension's default toolset. To widen the allowlist (e.g. add `browser_curl` or `manage_credentials`) or put a human in the loop before it acts, shadow the extension's connection. Mount as a directory and name the connection file `browser.ts`:

```
agent/extensions/kernel/
  extension.ts             # export default kernel({ connect: "mcp.onkernel.com/eve-extension" })
  connections/browser.ts   # shadows the extension's "browser" connection
```

```ts
// agent/extensions/kernel/connections/browser.ts
import { defineMcpClientConnection } from "eve/connections";
import { connect } from "@vercel/connect/eve";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.onkernel.com/mcp",
  description: "Kernel cloud browser.",
  auth: connect("mcp.onkernel.com/eve-extension"),
  tools: {
    allow: [
      "manage_browsers",
      "execute_playwright_code",
      "computer_action",
      "manage_auth_connections",
      "browser_curl", // high blast radius — raw HTTP through the session
    ],
  },
  approval: once(), // ask once per session before the agent controls the browser
});
```

`once()` asks the first time per session, `always()` on every tool call, and a custom `({ toolName, toolInput }) => ...` policy lets you gate only the calls that matter (e.g. a form submit) by inspecting the tool input. eve renders the prompt as Slack buttons and resumes when you answer.

## Prerequisites

- **Node 24+** — if you see `npm warn EBADENGINE` during install, your Node version is too old. The agent may still run on Node 22, but Node 24+ is required. Upgrade with `nvm install 24 && nvm use 24` or `brew install node@24`.
- **Vercel CLI** — `npm i -g vercel@latest` (needed for local dev, deployment, and the Connect connector)
- **A Kernel Vercel Connect connector** — set up once with `vercel connect create mcp.onkernel.com --name eve-extension && vercel connect attach mcp.onkernel.com/eve-extension` (see [Authentication](#authentication)). No API key required.
- **`AI_GATEWAY_API_KEY`** — routes the model through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (the default). To use a provider SDK directly instead, switch `agent/agent.ts` and set that provider's key (e.g. `ANTHROPIC_API_KEY`).

```bash
npm install
cp .env.example .env.local   # fill in the keys
```

## Run it locally (HTTP channel)

The default eve HTTP channel needs no setup. Start the dev server:

```bash
npm run dev            # eve dev — serves http://127.0.0.1:2000
```

Start a session with a task:

```bash
curl -s -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Go to news.ycombinator.com and give me the top 5 stories with their points and links."}'
# -> { "sessionId": "...", "continuationToken": "eve:..." }
```

Watch it work (it opens a browser, reads pages, acts, and streams progress until it finishes with the answer):

```bash
curl -N http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream
```

If the agent hits a blocker it parks at `input.requested` with a question. Answer it to resume — either the structured form:

```bash
curl -s -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -d '{"continuationToken":"eve:...","inputResponses":[{"requestId":"<id from input.requested>","optionId":"<option id>"}]}'
```

…or just a plain follow-up message (`{"continuationToken":"...","message":"I signed in, continue"}`).

## Deploy to Slack

`agent/channels/slack.ts` streams the agent's progress into a thread and renders any `ask_question` or approval prompt as native Slack buttons, resuming the session when you answer — no button-wiring code. Slack delivers events to a public URL, so you deploy first (local `eve dev` on `127.0.0.1` isn't reachable by Slack).

Slack credentials run through [Vercel Connect](https://vercel.com/docs/connect) (the path eve recommends): Connect provisions the Slack app, bot token, and webhook verification, so there's no token or signing secret in your code or env.

### 1. Link the project

```bash
npx vercel link
```

### 2. Set the model env var

Connect handles Slack and the Kernel browser; the agent still needs its model key on the Vercel project:

```bash
npx vercel env add AI_GATEWAY_API_KEY production  # model via the Vercel AI Gateway
```

### 3. Wire Slack through Connect

```bash
npm i -g vercel@latest && export FF_CONNECT_ENABLED=1
vercel connect create slack --triggers    # authorize the Slack app in your workspace; copy the UID, e.g. slack/kernel-eve-agent
vercel connect detach <uid> --yes
vercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes
```

`FF_CONNECT_ENABLED=1` turns on the (feature-flagged) Connect commands. `--triggers` enables Slack Event Subscriptions (`app_mention`, `message.im`). The `detach` + `attach --trigger-path /eve/v1/slack` re-points the webhook at eve's Slack route, which the default Connect path doesn't serve.

### 4. Set your Connect UID and fix Slack message visibility

In `agent/channels/slack.ts`, replace the placeholder UID with the one from step 3.

**Important:** Eve's default Slack adapter swallows intermediate text messages into a typing indicator when the model outputs text and then calls a tool (e.g. narrates what it's doing, then calls a browser tool). This means users never see the agent's progress or live-view URLs — only the final answer. Override the `message.completed` handler to always post so you can watch the agent work:

```ts
import { slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

export default slackChannel({
  credentials: connectSlackCredentials("slack/<your-uid>"),
  threadContext: { since: "last-agent-reply" },
  events: {
    // The default handler swallows text into a typing indicator when the model
    // outputs text and then calls a tool (finishReason === "tool-calls").
    // Override to always post it so summaries and live-view URLs are visible.
    async "message.completed"(data, channel) {
      if (data.message) {
        await channel.thread.post(data.message);
      }
    },
  },
});
```

Without this override, users see nothing until the agent posts its final result.

### 5. Deploy

```bash
npx eve deploy            # wraps `vercel deploy --prod` with the eve framework flag
```

### 6. Test

- Invite the bot to your channel: `/invite @your-app`.
- `@your-app grab the top 5 posts on Hacker News right now with their points and links`.
- It opens a browser, streams its progress as it works through the task, and posts the result. If it hits a blocker (a login, a captcha) it asks with buttons; otherwise it runs to completion on its own. The live-view link lets you watch or take over the browser directly.

### Alternative: classic Slack app (no Connect CLI)

If you'd rather not use the experimental Connect commands, set credentials via env vars instead:

- Create a Slack app ([api.slack.com/apps](https://api.slack.com/apps)) with bot scopes `app_mentions:read`, `chat:write` (+ `channels:history` for thread context); install it and copy the **Bot User OAuth Token** and **Signing Secret**.
- Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` on the Vercel project (alongside `KERNEL_API_KEY` / `AI_GATEWAY_API_KEY`), and change `agent/channels/slack.ts` to drop the Connect import:

  ```ts
  import { slackChannel } from "eve/channels/slack";
  export default slackChannel({ threadContext: { since: "last-agent-reply" } });
  ```

- After deploying, set the Slack app's **Event Subscriptions → Request URL** to `https://<deployment>/eve/v1/slack` and subscribe to `app_mention`.

## Troubleshooting

### `[UNLOADABLE_DEPENDENCY]` error on deploy

If `npx eve deploy` fails with an error referencing an absolute path like `.eve/dev-runtime/snapshots/.../compiled-artifacts-bootstrap.mjs`, the local dev cache is stale. Clear it and redeploy:

```bash
rm -rf .eve/dev-runtime
npx eve deploy
```

### `AI_GATEWAY_API_KEY` missing during Vercel build

Environment variables in `.env.local` are only used locally. For Vercel deployments, add them to the Vercel project:

```bash
npx vercel env add AI_GATEWAY_API_KEY production
```

### The browser connection isn't authorized

The extension authenticates through Vercel Connect. If the agent can't drive the browser, confirm the connector exists and is attached (`vercel connect list` should show `mcp.onkernel.com/eve-extension`), and that the connector UID in `agent/extensions/kernel.ts` matches. The first browser call per user surfaces a one-time Connect consent prompt — approve it to grant access.

### The model can't find the browser tools

Kernel's tools are discovered through eve's `connection_search`, and the extension needs **eve `>= 0.25`** — older eve silently ignores `agent/extensions/` (you'll see a "discover/unsupported-directory" warning and nothing mounts). Confirm your installed `eve` version, then check the tool names against what the server publishes via `connection_search`.

### Agent posts nothing in Slack until it's finished

See the `events` override in [step 4](#4-set-your-connect-uid-and-fix-slack-message-visibility). Eve's default Slack adapter buffers text as a typing indicator when the model calls a tool immediately after generating text — the override posts it instead.

## Notes

- The Kernel `session_id` returned by `manage_browsers` (`create`) is the handle for the browser — the agent passes it to every `execute_playwright_code` and `computer_action` call and reuses it across steps and across tasks, so the browser stays alive for follow-ups until you end it or it times out. If the id is ever lost, `manage_browsers` (`list`) recovers it. Set a generous `timeout_seconds` on create so the session doesn't expire mid-task, while parked on a blocker, or between requests.
- `read`-style calls use Playwright's public `ariaSnapshot()` to return the page's accessibility tree (roles, text, links). It's stable across both stealth (Patchright) and non-stealth browsers, unlike the internal `page._snapshotForAI()` which isn't present in stealth sessions. For a visual read, use `computer_action` with a `screenshot`.
