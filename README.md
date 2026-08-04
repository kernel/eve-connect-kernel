# Eve Authenticated Agent Cookbook

A cookbook for building a [eve](https://eve.dev) agent that works on **authenticated** websites — logging a user in through a real, human-in-the-loop flow, then driving the signed-in browser to finish the task. User-scoped access runs through [Vercel Connect](https://vercel.com/connect), so there's **no API key** in your app or env: each user authenticates as themselves, once.

---

## Cookbook

This cookbook uses:

- [eve](https://eve.dev) — the framework for building durable agents.
- [Vercel Connect](https://vercel.com/connect) — brokers a per-user token to Kernel, so no shared API key touches your app, env, or the model.
- [`@onkernel/eve-extension`](https://github.com/kernel/eve-extension) — one-line mount that gives the agent Kernel's browser toolset (sessions, Playwright, computer use, session replays) plus managed auth and profiles.
- [Kernel](https://www.kernel.sh) — fast cloud browsers for agents, with **managed auth**: a hosted login flow that gets a user signed in (MFA/SSO included) and keeps the session fresh.

The agent's behavior lives in [`agent/instructions.md`](./agent/instructions.md). It has two jobs, which map to the two recipes below.

### Recipes

- **Set up managed auth (human-in-the-loop).** "Log me into `github.com`." The agent opens Kernel's hosted login flow, hands you the link, and waits while you sign in and clear MFA — then saves the session to a reusable profile that re-authenticates on its own.
- **Drive an authenticated task.** "Using my GitHub profile, go to github.com/explore and tell me 3 things it's showing based on my interests." The agent opens a browser already signed in on that profile and works the task end-to-end, only stopping if it hits a genuine blocker.

## Prerequisites

- **Node.js 24+**.
- **A [Vercel](https://vercel.com) account + CLI** (`npm i -g vercel@latest`) — for the Connect connector, local dev, and deploy.
- **A [Kernel](https://www.kernel.sh) account** — no API key needed; you authorize Kernel once through Connect below.
- **A model credential.** The default model runs through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), which `vercel link` authenticates for you via a `VERCEL_OIDC_TOKEN` — so once the project is linked (below), there's nothing to set. Not linking? Put `AI_GATEWAY_API_KEY` in `.env.local`. To use a provider SDK directly instead, switch `agent/agent.ts` and set that provider's key (e.g. `ANTHROPIC_API_KEY`).

## How it works

### Authentication is per-user, through Vercel Connect

The browser connection authenticates through Vercel Connect — no `KERNEL_API_KEY` anywhere. The extension mount ([`agent/extensions/kernel.ts`](./agent/extensions/kernel.ts)) passes the connector UID:

```ts
import kernel from "@onkernel/eve-extension";

export default kernel({ connect: "kernel/eve-extension" });
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

```bash
npm install
npx vercel link              # links the project — also authenticates the AI Gateway via OIDC
npm run connect:kernel       # create + attach the Kernel connector (one time)
npm run dev                  # opens the interactive TUI
```

`connect:kernel` provisions the `kernel/eve-extension` connector the mount points at, so no key ever touches your app or env. `kernel` is Kernel's entry in Vercel's connector registry, so Vercel fills in the MCP URL, auth type, and branding — there's nothing to paste. Then, in the TUI:

- `Log me into github.com` → the agent posts a hosted login link; you sign in and clear MFA, and it saves the profile.
- `Using my github profile, go to github.com/explore and tell me 3 things it's showing based on my interests` → it opens a browser already signed in and reports back with the live-view URL.

The first browser action triggers the one-time Connect consent prompt; approve it and you won't see it again.

### Deploy flow (Slack)

Deployed, the agent streams its progress into a Slack thread and renders the sign-in handoff as a native button — the human-in-the-loop moment, one tap away. Slack needs a public URL, so this path is deploy-only.

```bash
npm i -g vercel@latest
npx vercel link
npm run connect:slack        # provision the Slack app + point its webhook at eve
npm run deploy
```

`connect:slack` creates the `slack/eve-connect-kernel` connector — the UID already wired into [`agent/channels/slack.ts`](./agent/channels/slack.ts) — then re-points its webhook at eve's `/eve/v1/slack` route. Connect provisions the app, bot token, scopes, and webhook verification, so no secrets touch your env and there's no UID to paste by hand. The linked deploy carries the same OIDC token, so the model needs no key either.

Then invite the bot (`/invite @your-app`) and message it: `@your-app log me into github.com`. It streams progress, drops the sign-in button when it needs you, and finishes the task on its own — with a live-view link so you can watch or take over.

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

## Learn more

- [Kernel managed auth](https://www.kernel.sh/docs) · [Kernel eve extension](https://github.com/kernel/eve-extension)
- [eve](https://eve.dev) · [Vercel Connect](https://vercel.com/connect)
