import { Kernel } from "@onkernel/sdk";
import { defineState } from "eve/context";

export const kernel = new Kernel(); // reads KERNEL_API_KEY from the environment

// Durable per-session slot holding the Kernel browser this session owns.
// Survives turns, pauses, and redeploys; never shared with subagents.
export const browser = defineState("kernel-browser-agent.browser", () => ({
  sessionId: null as string | null,
  liveViewUrl: null as string | null,
}));
