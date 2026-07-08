import { defineTool } from "eve/tools";
import { z } from "zod";
import { kernel, browser } from "../lib/kernel.js";

export default defineTool({
  description:
    "Read the current page as a compact, model-friendly snapshot (roles, text, interactive elements) plus its URL. Use it to decide which next actions to offer the user.",
  inputSchema: z.object({}),
  async execute() {
    const { sessionId } = browser.get();
    if (!sessionId) throw new Error("No browser open. Call open_browser first.");
    const res = await kernel.browsers.playwright.execute(sessionId, {
      code: "return { url: page.url(), snapshot: await page.locator('body').ariaSnapshot() };",
    });
    if (!res.success) throw new Error(res.error ?? res.stderr ?? "snapshot failed");
    return res.result;
  },
});
