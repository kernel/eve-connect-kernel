import { defineAgent } from "eve";
import { anthropic } from "@ai-sdk/anthropic";

// Defaults to the direct Anthropic provider (needs ANTHROPIC_API_KEY) so the
// example runs locally without a gateway. On Vercel you can instead pass a
// Vercel AI Gateway model slug string, e.g. "anthropic/claude-sonnet-4-6".
export default defineAgent({
  model: anthropic(process.env.EVE_MODEL ?? "claude-sonnet-4-6"),
});
