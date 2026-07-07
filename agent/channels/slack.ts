import { slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

// The Slack channel auto-renders every HITL prompt (ask_question options and
// approve/deny approvals) as buttons/selects and resumes the parked session on
// click — no button wiring needed here. Replace the Connect UID with yours.
export default slackChannel({
  credentials: connectSlackCredentials("slack/eve-browser-agent"),
  threadContext: { since: "last-agent-reply" },
});
