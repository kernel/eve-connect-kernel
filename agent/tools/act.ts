import { defineTool } from "eve/tools";
import { z } from "zod";
import { kernel, browser } from "../lib/kernel.js";

export default defineTool({
  description:
    "Run Playwright against the open browser to navigate, click, type, or read. `page`, `context`, and `browser` are in scope; end with `return` to get data back. Use this for reading and navigation; use `submit` for a state-changing action that needs human sign-off.",
  inputSchema: z.object({
    code: z
      .string()
      .describe("Playwright body, e.g. await page.getByRole('link', { name: 'Login' }).click();"),
    timeout_sec: z.number().int().min(1).max(300).optional(),
  }),
  async execute({ code, timeout_sec }) {
    const { sessionId } = browser.get();
    if (!sessionId) throw new Error("No browser open. Call open_browser first.");
    const res = await kernel.browsers.playwright.execute(sessionId, { code, timeout_sec });
    if (!res.success) throw new Error(res.error ?? res.stderr ?? "Playwright execution failed");
    return { result: res.result, stdout: res.stdout };
  },
});
