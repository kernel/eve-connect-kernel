# Eve + Vercel Connect + Kernel

A cookbook for building a [Vercel eve](https://eve.dev) agent that works on **authenticated** websites — logging a user in through a real, human-in-the-loop flow, then driving the signed-in browser to finish the task. Authentication runs through [Vercel Connect](https://vercel.com/connect), so there's **no API key** in your app or env: each user authenticates as themselves, once.

---

## Cookbook

This cookbook uses:

- [Vercel eve](https://eve.dev) — the framework for building durable agents.
- [Vercel Connect](https://vercel.com/connect) — brokers a per-user token to Kernel, so no shared API key touches your app, env, or the model.
- [`@onkernel/eve-extension`](https://github.com/kernel/eve-extension) — one-line mount that gives the agent Kernel's browser toolset (sessions, Playwright, computer use, session replays) plus managed auth and profiles.
- [Kernel](https://www.kernel.sh) — fast cloud browsers for agents, with **managed auth**: a hosted login flow that gets a user signed in (MFA/SSO included) and keeps the session fresh.

The agent's behavior lives in [`agent/instructions.md`](./agent/instructions.md). It has two jobs, which map to the two recipes below.

### Recipes

- **Set up managed auth (human-in-the-loop).** "Log me into `github.com`." The agent opens Kernel's hosted login flow, hands you the link, and waits while you sign in and clear MFA — then saves the session to a reusable profile that re-authenticates on its own.
- **Drive an authenticated task.** "Using my GitHub profile, summarize my last 5 notifications." The agent opens a browser already signed in on that profile and works the task end-to-end, only stopping if it hits a genuine blocker.

## Prerequisites

- **Node.js 24+**.
- **A [Vercel](https://vercel.com) account + CLI** (`npm i -g vercel@latest`) — for the Connect connector, local dev, and deploy.
- **A [Kernel](https://www.kernel.sh) account** — no API key needed; you authorize Kernel once through Connect below.
- **`AI_GATEWAY_API_KEY`** — routes the model through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). To use a provider SDK directly instead, switch `agent/agent.ts` and set that provider's key (e.g. `ANTHROPIC_API_KEY`).

## How it works

### Authentication is per-user, through Vercel Connect

The browser connection authenticates through Vercel Connect — no `KERNEL_API_KEY` anywhere. The extension mount ([`agent/extensions/kernel.ts`](./agent/extensions/kernel.ts)) passes the connector UID:

```ts
import kernel from "@onkernel/eve-extension";

export default kernel({ connect: "mcp.onkernel.com/eve-extension" });
```

The first time a user drives the browser, eve surfaces a one-time Connect consent prompt. They approve once and it's cached across threads and sessions. Each user acts as themselves — which is exactly what you want when the agent is about to log into *their* accounts.

### Profiles and managed auth

Two Kernel concepts carry the login state:

- A **profile** is a named, durable bundle of cookies and login state. It's the artifact the agent produces and reuses; a browser session loads a profile by name to start already signed in.
- A **managed auth connection** keeps a *profile + domain* logged in and re-authenticates on its own. Creating one runs a **hosted login flow** — a URL the user opens to sign in and clear MFA/SSO — so raw credentials never get typed into a page by the agent.

### The human-in-the-loop moment

Setting up auth is the one step only a person can do. The agent starts the login flow, posts you the hosted URL, and parks until you're done — rendered as a link in the TUI locally, or as a native button in Slack once deployed. Everything after that (driving the signed-in browser) runs on its own.

## Run it

### Dev flow (eve TUI)

**1. Install and create the Kernel connector** (name it `eve-extension` so the mount above works unedited):

```bash
npm install
vercel connect create mcp.onkernel.com --name eve-extension
vercel connect attach mcp.onkernel.com/eve-extension
```

**2. Set the model key:**

```bash
cp .env.example .env.local   # then fill in AI_GATEWAY_API_KEY
```

**3. Start the agent** — `eve dev` opens the interactive TUI where you chat with the agent and watch it work:

```bash
npx eve dev
```

**4. Run the recipes.** Type a task and watch the loop:

- `Log me into github.com` → the agent posts a hosted login link; you sign in and clear MFA, and it saves the profile.
- `Using my github profile, summarize my last 5 notifications` → it opens a browser already signed in and reports back with the live-view URL.

The first browser action triggers the one-time Connect consent prompt; approve it and you won't see it again.

### Deploy flow (Slack)

Deployed, the agent streams its progress into a Slack thread and renders the sign-in handoff as a native button — the human-in-the-loop moment, one tap away.

**1. Link the project and set the model key:**

```bash
npx vercel link
npx vercel env add AI_GATEWAY_API_KEY production
```

**2. Wire Slack through Connect** (Connect provisions the Slack app, bot token, and webhook — no secrets in your env):

```bash
npm i -g vercel@latest && export FF_CONNECT_ENABLED=1
vercel connect create slack --triggers            # authorize the app; copy the UID, e.g. slack/eve-connect-kernel
vercel connect detach <uid> --yes
vercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes
```

Set that UID in [`agent/channels/slack.ts`](./agent/channels/slack.ts).

**3. Deploy:**

```bash
npx eve deploy
```

**4. Use it.** Invite the bot (`/invite @your-app`) and message it: `@your-app log me into github.com`. It streams progress, drops the sign-in button when it needs you, and finishes the task on its own — with a live-view link so you can watch or take over.

## Project layout

```
agent/
  agent.ts               # model (routed through the Vercel AI Gateway)
  instructions.md        # base: how to act on the open web with Kernel (the browse loop, stealth, logins)
  skills/kernel-auth.md  # prescriptive: the managed-auth hosted-login flow, step by step
  extensions/kernel.ts   # mounts @onkernel/eve-extension — Kernel browser tools via Connect
  channels/eve.ts        # local HTTP channel, locked to loopback
  channels/slack.ts      # Slack channel — streams progress, renders the sign-in handoff as a button
```

See [`docs/at-a-glance.md`](./docs/at-a-glance.md) for a file-by-file walkthrough.

## Learn more

- [Kernel managed auth](https://www.kernel.sh/docs) · [Kernel eve extension](https://github.com/kernel/eve-extension)
- [Vercel eve](https://eve.dev) · [Vercel Connect](https://vercel.com/connect)
