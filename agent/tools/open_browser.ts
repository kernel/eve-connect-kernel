import { defineTool } from "eve/tools";
import { z } from "zod";
import { kernel, browser } from "../lib/kernel.js";

export default defineTool({
  description:
    "Open the Kernel cloud browser for this session, creating it if one isn't already running. Returns the session id and a live view URL a human can watch or take over. Safe to call again — it reuses the existing browser.",
  inputSchema: z.object({
    stealth: z.boolean().optional().describe("Reduce anti-bot detection. Recommended for real sites."),
    start_url: z.string().url().optional().describe("URL to open when the browser starts."),
  }),
  async execute({ stealth, start_url }) {
    const existing = browser.get();
    if (existing.sessionId) {
      return { session_id: existing.sessionId, live_view_url: existing.liveViewUrl, reused: true };
    }
    const created = await kernel.browsers.create({ stealth, start_url, timeout_seconds: 3600 });
    browser.update((s) => ({
      ...s,
      sessionId: created.session_id,
      liveViewUrl: created.browser_live_view_url ?? null,
    }));
    return {
      session_id: created.session_id,
      live_view_url: created.browser_live_view_url ?? null,
      reused: false,
    };
  },
});
