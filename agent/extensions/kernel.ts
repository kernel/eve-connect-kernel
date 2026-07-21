import kernel from "@onkernel/eve-extension";

// Kernel's browser toolset — session management, Playwright execution, and
// human-like computer controls, plus a `browse` skill — mounted from the
// published extension. eve discovers the tools at runtime and surfaces them to
// the model as `kernel__browser__<tool>` via `connection_search`, so this agent
// ships no browser tool code of its own.
//
// Auth runs through Vercel Connect (no API key): each user authenticates as
// themselves with a one-time consent that's cached afterward. Create the
// connector once with `vercel connect create mcp.onkernel.com --name eve-extension`
// (see README) — no key ever touches the app, env, or the model.
export default kernel({ connect: "mcp.onkernel.com/eve-extension" });
