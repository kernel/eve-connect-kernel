import { defineMcpClientConnection } from "eve/connections";

// Kernel's hosted MCP server exposes the whole cloud-browser toolset — session
// management, Playwright execution, and human-like computer controls — so this
// agent ships no browser tools of its own. eve discovers the tools at runtime
// and surfaces them to the model as `kernel__<tool>` via `connection_search`.
//
// Auth: Kernel's MCP treats a non-JWT bearer token as a Kernel API key, so we
// hand it one from the environment. `auth` is pluggable — swap `getToken` for
// an OAuth-based provider if you'd rather not manage a static key.
export default defineMcpClientConnection({
  url: "https://mcp.onkernel.com/mcp",
  description:
    "Kernel cloud browser. Create and manage browser sessions, run Playwright code against a live page, and drive it with mouse/keyboard/screenshot computer controls.",
  auth: {
    getToken: async () => ({ token: process.env.KERNEL_API_KEY! }),
  },
  // The tools needed to open a browser and drive it end-to-end. Kernel's MCP
  // exposes more (profiles, managed auth, shell, etc.) — add them here as your
  // agent needs them. Leaving the destructive/account-management ones out keeps
  // an autonomous agent's blast radius small.
  tools: {
    allow: [
      "manage_browsers",
      "execute_playwright_code",
      "computer_action",
      "browser_curl",
    ],
  },
  // No approval gate — the agent runs autonomously. To pause for a human before
  // irreversible actions, add e.g. `approval: once()` (from "eve/tools/approval")
  // or a custom policy that inspects the tool input.
});
