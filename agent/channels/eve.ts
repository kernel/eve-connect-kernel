import { eveChannel } from "eve/channels/eve";
import { localDev } from "eve/channels/auth";

// Lock the agent to Slack only. The eve HTTP session API (/eve/v1/session*)
// otherwise accepts Vercel OIDC / team deploy tokens — a non-Slack way to drive
// the agent. localDev() matches only loopback requests, so `eve dev` keeps
// working locally while every deployed HTTP request is rejected with 401. The
// Slack channel uses a separate route and is unaffected; GET /eve/v1/health
// stays public for uptime probes.
export default eveChannel({ auth: [localDev()] });
