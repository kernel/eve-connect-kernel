# eve-browser-agent

A [Vercel eve](https://vercel.com/eve) agent that drives a [Kernel](https://www.kernel.sh) cloud browser as a human-in-the-loop loop: it opens a browser, reads the page, and asks you what to do next as **buttons**. You pick one, it performs that single action, reads the new page, and asks again — repeating until you say you're done. State-changing actions ask for explicit approval first.

The browser tools aren't built here. They come from **[Kernel's hosted MCP server](https://github.com/onkernel/kernel-mcp-server)**: one connection file points eve at Kernel and every browser tool — session management, Playwright execution, and human-like computer controls — shows up automatically. No custom tool code to write or maintain.

## How it works

eve loads any file under `agent/connections/` as a connection. `agent/connections/kernel.ts` is a single `defineMcpClientConnection` pointing at `https://mcp.onkernel.com/mcp`; eve discovers Kernel's tools at runtime and exposes them to the model as `kernel__<tool>` via its `connection_search` tool. The three the agent uses:

- **`manage_browsers`** — create, list, get, and delete browser sessions. Returns a `session_id` and a `live_view_url` you can watch or take over.
- **`execute_playwright_code`** — run Playwright against the live page to read, navigate, click, or type.
- **`computer_action`** — human-like mouse, keyboard, and screenshot controls for the same session.

Two things wrap those tools into a safe, watchable loop:

- **The loop itself** lives in [`agent/instructions.md`](agent/instructions.md): after each action the agent summarizes the page, then calls eve's built-in `ask_question` with options built from the current page — which the Slack channel auto-renders as buttons — and waits.
- **An approval gate** on the connection (`approval: once()`) asks for a human OK before the agent first takes control of the browser. The button loop keeps you choosing every step after that, and the instructions have the agent confirm before anything irreversible (a submit, send, or purchase).

```
agent/
  agent.ts               # model (defaults to the direct Anthropic provider)
  instructions.md        # the ask -> act -> ask loop
  connections/kernel.ts  # Kernel MCP connection — provides the browser tools
  channels/eve.ts        # default HTTP channel, locked to loopback
  channels/slack.ts      # Slack channel — auto-renders HITL prompts as buttons
```

## Authentication, and the road to Vercel Connect

Kernel's MCP server treats a non-JWT bearer token as a Kernel API key, so the connection hands it `KERNEL_API_KEY` from the environment:

```ts
auth: { getToken: async () => ({ token: process.env.KERNEL_API_KEY! }) }
```

This is a stand-in for [Vercel Connect](https://vercel.com/docs/connect). Once Kernel is available as a preset Connect connector, swap the static token for Connect and the credential never touches the app or the model:

```ts
import { connect } from "@vercel/connect/eve";
// ...
auth: connect("<connector-uid>"),
```

At that point `KERNEL_API_KEY` goes away — Connect owns the token storage and refresh. Everything else in this repo stays the same.

## Prerequisites

- **Node 24+** — if you see `npm warn EBADENGINE` during install, your Node version is too old. The agent may still run on Node 22, but Node 24+ is required. Upgrade with `nvm install 24 && nvm use 24` or `brew install node@24`.
- **Vercel CLI** — `npm i -g vercel@latest` (needed for local dev and deployment)
- **`KERNEL_API_KEY`** — a Kernel API key (https://www.kernel.sh)
- A model key — **`ANTHROPIC_API_KEY`** for the default direct provider (or set `AI_GATEWAY_API_KEY` and switch `agent/agent.ts` to a Vercel AI Gateway model slug)

```bash
npm install
cp .env.example .env.local   # fill in the keys
```

## Run it locally (HTTP channel)

The default eve HTTP channel needs no setup. Start the dev server:

```bash
npm run dev            # eve dev — serves http://127.0.0.1:2000
```

Start a session:

```bash
curl -s -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Open https://example.com and walk me through it, asking me what to do next."}'
# -> { "sessionId": "...", "continuationToken": "eve:..." }
```

Watch the events (the agent opens a browser, reads the page, then parks at `input.requested` with your options):

```bash
curl -N http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream
```

Answer a prompt to resume the loop — either the structured form:

```bash
curl -s -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -d '{"continuationToken":"eve:...","inputResponses":[{"requestId":"<id from input.requested>","optionId":"<option id>"}]}'
```

…or just a plain follow-up message (`{"continuationToken":"...","message":"click the login link"}`), which matches against the option labels/ids.

## Deploy to Slack

`agent/channels/slack.ts` renders every `ask_question` and approval as native Slack buttons and resumes the session when you click — no button-wiring code. Slack delivers events to a public URL, so you deploy first (local `eve dev` on `127.0.0.1` isn't reachable by Slack).

Slack credentials run through [Vercel Connect](https://vercel.com/docs/connect) (the path eve recommends): Connect provisions the Slack app, bot token, and webhook verification, so there's no token or signing secret in your code or env.

### 1. Link the project

```bash
npx vercel link
```

### 2. Set the model + browser env vars

Connect handles Slack; the agent still needs its model and browser keys on the Vercel project:

```bash
npx vercel env add KERNEL_API_KEY production      # Kernel cloud browser (bearer token for the MCP connection)
npx vercel env add ANTHROPIC_API_KEY production   # model (or switch agent.ts to an AI Gateway slug)
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

**Important:** Eve's default Slack adapter swallows intermediate text messages into a typing indicator when the model outputs text and then calls a tool (e.g. summarizes the page, then calls `ask_question`). This means users never see the agent's descriptions, live-view URLs, or any content before the buttons. Override the `message.completed` handler to always post:

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

Without this override, users only see buttons with no context about what's on the page.

### 5. Deploy

```bash
npx eve deploy            # wraps `vercel deploy --prod` with the eve framework flag
```

### 6. Test

- Invite the bot to your channel: `/invite @your-app`.
- `@your-app open https://example.com and walk me through it`.
- It replies with buttons; click one and it performs that action, then posts fresh buttons from the new page. The first browser action shows an **Approve** prompt, and any irreversible step (submit, send, purchase) asks again. The live-view link lets you take over the browser directly.

### Alternative: classic Slack app (no Connect CLI)

If you'd rather not use the experimental Connect commands, set credentials via env vars instead:

- Create a Slack app ([api.slack.com/apps](https://api.slack.com/apps)) with bot scopes `app_mentions:read`, `chat:write` (+ `channels:history` for thread context); install it and copy the **Bot User OAuth Token** and **Signing Secret**.
- Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` on the Vercel project (alongside `KERNEL_API_KEY` / `ANTHROPIC_API_KEY`), and change `agent/channels/slack.ts` to drop the Connect import:

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

### `KERNEL_API_KEY` missing during Vercel build

Environment variables in `.env.local` are only used locally. For Vercel deployments, add them to the Vercel project:

```bash
npx vercel env add KERNEL_API_KEY production
npx vercel env add ANTHROPIC_API_KEY production
```

### The model can't find the browser tools

Kernel's tools are discovered through eve's `connection_search`, keyed off the connection `description` in `agent/connections/kernel.ts`. If the model doesn't reach for them, make the description more specific, and confirm the tool names in `tools.allow` still match what the server publishes.

### Agent shows buttons but no page summary in Slack

See the `events` override in [step 4](#4-set-your-connect-uid-and-fix-slack-message-visibility). Eve's default Slack adapter buffers text as a typing indicator when the model calls a tool immediately after generating text — the override posts it instead.

## Notes

- The Kernel `session_id` returned by `manage_browsers` (`create`) is the handle for the whole loop — the agent passes it to every `execute_playwright_code` and `computer_action` call and reuses it across turns, so the browser persists while the agent waits for input. If the id is ever lost, `manage_browsers` (`list`) recovers it. Set a generous `timeout_seconds` on create so the session doesn't expire while parked.
- `read`-style calls use Playwright's public `ariaSnapshot()` to return the page's accessibility tree (roles, text, links). It's stable across both stealth (Patchright) and non-stealth browsers, unlike the internal `page._snapshotForAI()` which isn't present in stealth sessions. For a visual read, use `computer_action` with a `screenshot`.
