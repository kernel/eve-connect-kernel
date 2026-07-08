# eve-browser-agent

A [Vercel eve](https://vercel.com/eve) agent that drives a [Kernel](https://www.kernel.sh) cloud browser as a human-in-the-loop loop: it opens a browser, reads the page, and asks you what to do next as **buttons**. You pick one, it performs that single action, reads the new page, and asks again — repeating until you say you're done. State-changing actions ask for explicit approval first.

The loop is powered by eve's built-in `ask_question` tool (which the Slack channel auto-renders as buttons) plus an `approval`-gated `submit` tool. The Kernel browser session is held across turns with eve's durable `defineState`, so the browser persists while the agent waits for you — even across restarts.

## How it works

- **`open_browser`** — creates (or reuses) a Kernel browser; returns the `session_id` and a `live_view_url` you can watch or take over.
- **`read_page`** — returns a compact snapshot of the current page so the agent can propose real next steps.
- **`act`** — runs Playwright in the browser (navigate, click, type, read).
- **`submit`** — same, but `approval: always()` so it pauses for your approve/deny before running. Use for form submits, purchases, sends.
- **`close_browser`** — deletes the session when the task is done.
- The **loop itself** lives in `agent/instructions.md`: after each action the agent calls the built-in `ask_question` with dynamic options built from the current page, then waits.

```
agent/
  agent.ts            # model (defaults to the direct Anthropic provider)
  instructions.md     # the ask -> act -> ask loop
  lib/kernel.ts       # Kernel client + durable browser-session state
  tools/              # open_browser, read_page, act, submit, close_browser
  channels/slack.ts   # Slack channel — auto-renders HITL prompts as buttons
```

## Prerequisites

- **Node 24+**
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

Credentials run through [Vercel Connect](https://vercel.com/docs/connect) (the path eve recommends): Connect provisions the Slack app, bot token, and webhook verification, so there's no token or signing secret in your code or env.

### 1. Link the project

```bash
npx vercel link
```

### 2. Set the model + browser env vars

Connect only handles Slack; the agent still needs its model and browser keys on the Vercel project:

```bash
npx vercel env add KERNEL_API_KEY production      # Kernel cloud browser
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

### 4. Set your Connect UID

In `agent/channels/slack.ts`, replace the placeholder UID with the one from step 3:

```ts
export default slackChannel({
  credentials: connectSlackCredentials("slack/<your-uid>"),
  threadContext: { since: "last-agent-reply" },
});
```

### 5. Deploy

```bash
npx eve deploy            # wraps `vercel deploy --prod` with the eve framework flag
```

### 6. Test

- Invite the bot to your channel: `/invite @your-app`.
- `@your-app open https://example.com and walk me through it`.
- It replies with buttons; click one and it performs that action, then posts fresh buttons from the new page. A `submit` action shows **Approve / Deny**. The live-view link lets you take over the browser directly.

### Alternative: classic Slack app (no Connect CLI)

If you'd rather not use the experimental Connect commands, set credentials via env vars instead:

- Create a Slack app ([api.slack.com/apps](https://api.slack.com/apps)) with bot scopes `app_mentions:read`, `chat:write` (+ `channels:history` for thread context); install it and copy the **Bot User OAuth Token** and **Signing Secret**.
- Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` on the Vercel project (alongside `KERNEL_API_KEY` / `ANTHROPIC_API_KEY`), and change `agent/channels/slack.ts` to drop the Connect import:

  ```ts
  import { slackChannel } from "eve/channels/slack";
  export default slackChannel({ threadContext: { since: "last-agent-reply" } });
  ```

- After deploying, set the Slack app's **Event Subscriptions → Request URL** to `https://<deployment>/eve/v1/slack` and subscribe to `app_mention`.

## Notes

- The Kernel `session_id` is stored with `defineState` (`agent/lib/kernel.ts`), which is durable and per-session, so the browser survives while the agent waits for input. `open_browser` is idempotent (reuses the existing session).
- `read_page` uses Playwright's public `ariaSnapshot()` to return the page's accessibility tree (roles, text, links). It's stable across both stealth (Patchright) and non-stealth browsers, unlike the internal `page._snapshotForAI()` which isn't present in stealth sessions. Binary data (screenshots, downloads) doesn't serialize through Playwright execution — capture those with Kernel's dedicated APIs if you need them.
