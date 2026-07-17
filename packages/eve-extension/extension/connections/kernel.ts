import { defineMcpClientConnection } from "eve/connections";
import extension from "../extension";

// Kernel's hosted MCP server exposes the whole cloud-browser toolset — session
// management, Playwright execution, and human-like computer controls — so this
// extension ships no browser tools of its own. eve discovers the tools at runtime
// and surfaces them to the model as `kernel__<tool>` via `connection_search`.
//
// Auth: Kernel's MCP treats a non-JWT bearer token as a Kernel API key, so we
// hand it the one from config. `auth` is pluggable — to issue tokens out of band
// instead (e.g. Vercel Connect's Kernel preset), override this connection and
// swap `getToken` for an OAuth provider.
export default defineMcpClientConnection({
  url: extension.config.mcpUrl,
  description:
    "Kernel cloud browser. Create and manage browser sessions, run Playwright code against a live page, and drive it with mouse/keyboard/screenshot computer controls.",
  auth: {
    getToken: async () => ({ token: extension.config.apiKey }),
  },
  // The tools needed to open a browser, drive it end-to-end, and log into sites
  // via Kernel's managed auth. Kernel's MCP exposes more (profiles, proxies,
  // shell, app management, etc.) — widen this by overriding the connection.
  // Leaving the destructive/account-management tools out keeps an autonomous
  // agent's blast radius small.
  tools: {
    allow: [
      "manage_browsers",
      "execute_playwright_code",
      "computer_action",
      "browser_curl",
      "manage_auth_connections",
      "manage_credentials",
    ],
  },
  // No approval gate — the agent runs autonomously. Consumers can override this
  // connection to add e.g. `approval: once()` (from "eve/tools/approval") or a
  // custom policy that inspects the tool input before irreversible actions.
});
