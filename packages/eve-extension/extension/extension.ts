import { defineExtension } from "eve/extension";
import { z } from "zod";

// The Kernel extension packages a single MCP connection (see connections/kernel.ts)
// and a browsing skill. Mounting it gives an agent Kernel's whole cloud-browser
// toolset — session management, Playwright execution, and human-like computer
// controls — surfaced as `kernel__<tool>`, plus the read -> act -> observe loop
// as a skill. No browser tool code to write or maintain.
//
// Consumers mount it under agent/extensions/ and pass their settings:
//
//   // agent/extensions/kernel.ts
//   import kernel from "@onkernel/eve";
//   export default kernel({ apiKey: process.env.KERNEL_API_KEY });
//
// Auth is a static Kernel API key by default. To issue and refresh tokens out of
// band instead — e.g. through Vercel Connect's Kernel preset connector — leave
// `apiKey` unset and swap the connection's `auth` for a Connect provider
// (see connections/kernel.ts and the README).
export default defineExtension({
  config: z.object({
    // Kernel API key, sent as the bearer token for the MCP connection. Get one
    // at https://dashboard.onkernel.com/api-keys. Optional so the connection can
    // instead use a Vercel Connect / OAuth auth provider.
    apiKey: z.string().optional(),
    // Override the Kernel MCP endpoint (defaults to the hosted server).
    mcpUrl: z.string().default("https://mcp.onkernel.com/mcp"),
  }),
});
