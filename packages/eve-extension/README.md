# @onkernel/eve

A [Vercel eve](https://vercel.com/eve) extension that gives an agent a [Kernel](https://www.kernel.sh) cloud browser. Mount it in one line and Kernel's whole browser toolset — session management, Playwright execution, and human-like computer controls — shows up as `kernel__<tool>`, plus a `browse` skill with the read → act → observe loop. No browser tool code to write or maintain.

The tools aren't reimplemented here. The extension packages a single MCP connection to **[Kernel's hosted MCP server](https://github.com/onkernel/kernel-mcp-server)**; eve discovers the tools at runtime.

## Install

```bash
npm install @onkernel/eve
```

## Mount it

Add a one-line mount under `agent/extensions/`:

```ts
// agent/extensions/kernel.ts
import kernel from "@onkernel/eve";

export default kernel({ apiKey: process.env.KERNEL_API_KEY });
```

That's it. The agent now has:

- **`kernel__manage_browsers`** — create, list, get, delete browser sessions. Returns a `session_id` and a `live_view_url` you can watch or take over.
- **`kernel__execute_playwright_code`** — run Playwright against the live page to read, navigate, click, or type.
- **`kernel__computer_action`** — human-like mouse, keyboard, and screenshot controls for the same session.
- **`kernel__browser_curl`** — send HTTP requests through the browser session's network stack.
- **`kernel__manage_auth_connections`** + **`kernel__manage_credentials`** — Kernel's managed auth, so the agent logs into sites through a stored connection or a hosted login flow instead of typing credentials into the page.
- the **`browse`** skill — the loop the model follows to drive the browser end-to-end.

Get an API key at [dashboard.onkernel.com/api-keys](https://dashboard.onkernel.com/api-keys).

## Configuration

`kernel({ ... })` accepts:

| Option   | Default                        | Purpose                                                          |
| -------- | ------------------------------ | --------------------------------------------------------------- |
| `apiKey` | required                       | Kernel API key, sent as the bearer token for the MCP connection. |
| `mcpUrl` | `https://mcp.onkernel.com/mcp` | Override the Kernel MCP endpoint.                                |

## Auth: static key or Vercel Connect

By default the connection uses a static `KERNEL_API_KEY`. Since Kernel is a [Vercel Connect](https://vercel.com/connect) preset connector, you can instead let Connect issue and refresh OAuth tokens out of band — so no key touches your app, env, or the model. Override the connection's `auth` with a Connect provider (see [Overrides](#overriding-the-connection)).

## Overriding the connection

Mount as a directory instead of a file to override what the extension ships — for example, to widen the tool allowlist, add an approval gate before irreversible actions, or swap the auth provider:

```
agent/extensions/kernel/
  extension.ts
  connections/kernel.ts
```

```ts
// agent/extensions/kernel/connections/kernel.ts
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.onkernel.com/mcp",
  description: "Kernel cloud browser.",
  auth: { getToken: async () => ({ token: process.env.KERNEL_API_KEY! }) },
  tools: {
    allow: [
      "manage_browsers",
      "execute_playwright_code",
      "computer_action",
      "browser_curl",
      "manage_auth_connections",
      "manage_credentials",
      "manage_profiles", // e.g. add profiles/proxies as your agent needs them
      "manage_proxies",
    ],
  },
  approval: once(), // ask once per session before the agent controls the browser
});
```

## Prerequisites

- **Node 24+**
- A **Kernel API key** (or a Vercel Connect Kernel connector)
- **eve** in the consuming agent — the extension keeps `eve` as a wildcard peer so the consumer's installed eve is the one that runs

## Develop

```bash
npm install
npm run typecheck
npm run build        # eve extension build — transpiles entry points + type decls
```

## License

MIT
