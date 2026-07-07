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

## Run it in Slack

The Slack channel renders every `ask_question` and approval as native buttons and resumes the session when you click — no button wiring in this repo. Credentials go through [Vercel Connect](https://vercel.com/docs/connect), so there's no bot token in code.

```bash
npm install -g vercel@latest && export FF_CONNECT_ENABLED=1
vercel connect create slack --triggers
vercel connect detach <uid> --yes
vercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes
```

Set the Connect UID in `agent/channels/slack.ts`, then deploy:

```bash
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 vercel deploy --prod
```

`@mention` the agent — "book me the first available slot on this page" — and it will drive the browser, posting buttons whenever it needs a decision and the live-view link whenever it needs you to step in.

## Notes

- The Kernel `session_id` is stored with `defineState` (`agent/lib/kernel.ts`), which is durable and per-session, so the browser survives while the agent waits for input. `open_browser` is idempotent (reuses the existing session).
- `read_page` uses `page._snapshotForAI()`. Binary data (screenshots, downloads) doesn't serialize through Playwright execution — capture those with Kernel's dedicated APIs if you need them.
