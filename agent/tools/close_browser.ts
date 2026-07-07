import { defineTool } from "eve/tools";
import { z } from "zod";
import { kernel, browser } from "../lib/kernel.js";

export default defineTool({
  description: "Close the Kernel browser for this session. Call when the task is complete.",
  inputSchema: z.object({}),
  async execute() {
    const { sessionId } = browser.get();
    if (!sessionId) return { closed: false };
    await kernel.browsers.deleteByID(sessionId);
    browser.update((s) => ({ ...s, sessionId: null, liveViewUrl: null }));
    return { closed: true };
  },
});
