import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

// vercelOidc() authenticates the local user so Connect user-scoped connections
// (like the Kernel extension) can mint per-user tokens in `eve dev`.
// localDev() allows unauthenticated loopback requests as a fallback.
export default eveChannel({ auth: [vercelOidc(), localDev()] });
