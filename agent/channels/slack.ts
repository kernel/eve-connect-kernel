import { slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

// Credentials run through Vercel Connect — no bot token or signing secret in
// code or env. Replace the UID with the one from `vercel connect create slack`
// (see the README "Deploy to Slack" walkthrough). To use a classic Slack app
// with SLACK_BOT_TOKEN / SLACK_SIGNING_SECRET env vars instead, drop the
// credentials line and this import.
export default slackChannel({
  credentials: connectSlackCredentials("slack/kernel-eve-agent"),
  threadContext: { since: "last-agent-reply" },
});
