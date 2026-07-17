import { defineExtension } from "eve/extension";
import { z } from "zod";

// The Kernel extension packages a single MCP connection (see connections/kernel.ts)
// and a browsing skill. Mounting it gives an agent Kernel's whole cloud-browser
// toolset, surfaced as `kernel__<tool>`, plus the read -> act -> observe loop as a
// skill:
//
//   // agent/extensions/kernel.ts
//   import kernel from "@onkernel/eve";
//   export default kernel({ apiKey: process.env.KERNEL_API_KEY });
export default defineExtension({
  config: z.object({
    // Kernel API key, sent as the bearer token for the MCP connection. Get one
    // at https://dashboard.onkernel.com/api-keys.
    apiKey: z.string(),
    mcpUrl: z.string().default("https://mcp.onkernel.com/mcp"),
  }),
});
