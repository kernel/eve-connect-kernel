import { slackChannel } from "eve/channels/slack";

// Renders every ask_question / approval as Slack buttons and resumes the parked
// session on click — no button wiring needed. By default it reads
// SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET from the environment (classic Slack
// app). To use Vercel Connect instead, see the README and pass
// `credentials: connectSlackCredentials("slack/<uid>")`.
export default slackChannel({
  threadContext: { since: "last-agent-reply" },
});
