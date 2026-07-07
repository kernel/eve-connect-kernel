import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { kernel, browser } from "../lib/kernel.js";

export default defineTool({
  description:
    "Perform a state-changing action in the browser (submit a form, place an order, send a message) after the human approves it. Put a clear, plain-language effect in `summary` — that is what the approval prompt shows.",
  inputSchema: z.object({
    summary: z.string().describe("What this will do, shown to the human in the approval prompt."),
    code: z.string().describe("Playwright body that performs the action; return confirmation data."),
    timeout_sec: z.number().int().min(1).max(300).optional(),
  }),
  approval: always(),
  async execute({ code, timeout_sec }) {
    const { sessionId } = browser.get();
    if (!sessionId) throw new Error("No browser open. Call open_browser first.");
    const res = await kernel.browsers.playwright.execute(sessionId, { code, timeout_sec });
    if (!res.success) throw new Error(res.error ?? res.stderr ?? "Playwright execution failed");
    return { result: res.result, stdout: res.stdout };
  },
});
