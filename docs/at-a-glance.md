# This cookbook at a glance

The whole agent is a handful of files:

```text
eve-connect-kernel/
├── package.json
├── .env.example
└── agent/
    ├── agent.ts
    ├── instructions.md
    ├── extensions/
    │   └── kernel.ts
    ├── skills/
    │   └── kernel-auth.md
    └── channels/
        ├── eve.ts
        └── slack.ts
```

You can understand the whole thing by reading that tree:

* `instructions.md` tells the agent who it is and how to act on the open web with Kernel — the browse loop, using stealth for real sites, and when to reach for a login.
* [`agent.ts`](https://eve.dev/docs/agent-config) chooses the model and configures runtime options (here, the Vercel AI Gateway).
* [`extensions/kernel.ts`](https://github.com/kernel/eve-extension) mounts `@onkernel/eve-extension`, which gives the agent Kernel's browser toolset — sessions, Playwright, computer use, profiles, and managed auth — authenticated per-user through [Vercel Connect](https://vercel.com/connect), so there's no API key in the app.
* [`skills/`](https://eve.dev/docs/skills) holds longer procedures the model loads only when useful. `kernel-auth.md` is the step-by-step managed-auth flow — set up a connection, run the human-in-the-loop hosted login, reuse the authenticated profile.
* [`channels/`](https://eve.dev/docs/channels/overview) connect the agent to where people talk to it. `eve.ts` is the local HTTP channel (locked to loopback) you use in the dev TUI; `slack.ts` is the deploy target that streams progress and renders the sign-in handoff as a native button.

Start by reading `instructions.md` and `skills/kernel-auth.md` — together they're the whole behavior. Everything else is wiring.
