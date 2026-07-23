import { slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

export default slackChannel({
  credentials: connectSlackCredentials("slack/eve-connect-kernel"),
  threadContext: { since: "last-agent-reply" },
  events: {
    // The default handler swallows text into a typing indicator when the model
    // outputs text and then calls a tool (finishReason === "tool-calls").
    // Override to always post it so summaries and live-view URLs are visible.
    async "message.completed"(data, channel) {
      if (data.message) {
        await channel.thread.post(data.message);
      }
    },
  },
});
