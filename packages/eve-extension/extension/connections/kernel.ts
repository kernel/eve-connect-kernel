import { defineMcpClientConnection } from "eve/connections";
import extension from "../extension";

// Kernel's hosted MCP server exposes the whole cloud-browser toolset — session
// management, Playwright execution, and human-like computer controls — so this
// extension ships no browser tools of its own. eve discovers the tools at runtime
// and surfaces them to the model as `kernel__<tool>` via `connection_search`.
//
// Auth: Kernel's MCP treats a non-JWT bearer token as a Kernel API key, so when
// the consumer passes one via config we hand it over. `auth` is pluggable — if
// you'd rather not manage a static key, drop `apiKey` from the mount and swap
// `getToken` for an OAuth provider (e.g. Vercel Connect's Kernel preset) so
// tokens are issued and refreshed out of band and never touch the app or model.
export default defineMcpClientConnection({
  url: extension.config.mcpUrl,
  description:
    "Kernel cloud browser. Create and manage browser sessions, run Playwright code against a live page, and drive it with mouse/keyboard/screenshot computer controls.",
  auth: {
    getToken: async () => {
      const { apiKey } = extension.config;
      if (!apiKey) {
        throw new Error(
          "Kernel extension: no apiKey configured. Pass one when mounting " +
            "(kernel({ apiKey: process.env.KERNEL_API_KEY })) or replace this " +
            "auth block with a Vercel Connect / OAuth provider.",
        );
      }
      return { token: apiKey };
    },
  },
  // The tools needed to open a browser, drive it end-to-end, and log into sites
  // via Kernel's managed auth. Kernel's MCP exposes more (profiles, proxies,
  // shell, app management, etc.) — a consumer can widen this by overriding the
  // connection in their agent/extensions/kernel/ directory. Leaving the
  // destructive/account-management tools out keeps an autonomous agent's blast
  // radius small.
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
