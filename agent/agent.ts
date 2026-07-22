import { defineAgent } from "eve";

// Routes the model through the Vercel AI Gateway (needs AI_GATEWAY_API_KEY, or
// Vercel OIDC when deployed). Passing a gateway model slug lets eve resolve the
// model's context window from the gateway catalog, so auto-compaction triggers
// at the right threshold instead of overrunning the provider's context limit.
// Override the slug with EVE_MODEL. To use a provider SDK directly instead, add
// that provider (e.g. `@ai-sdk/anthropic`) and pass its model here.
export default defineAgent({
  model: process.env.EVE_MODEL ?? "anthropic/claude-sonnet-5",
  // Kernel's MCP toolset is large, so the browser observations the agent
  // accumulates (page snapshots, screenshots) fill the window fast. Compact at
  // 75% instead of the default 90% to leave headroom and keep long, multi-step
  // browser tasks from overrunning the context limit.
  compaction: {
    thresholdPercent: 0.75,
  },
});
