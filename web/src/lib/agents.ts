// MCP + coding-agent setup snippets, shared by the public guide (/docs/agents)
// and the in-app "Connect your AI agent" card (which fills in a real token).

export const MCP_TOOLS: { name: string; desc: string; write?: boolean }[] = [
  { name: "log_event", desc: "Record an event (channel, event, description, icon, notify, tags, user_id).", write: true },
  { name: "identify_user", desc: "Attach or merge properties for a user_id.", write: true },
  { name: "set_insight", desc: "Create or overwrite a KPI tile.", write: true },
  { name: "increment_insight", desc: "Add to a numeric KPI tile.", write: true },
  { name: "search_events", desc: "Newest-first events filtered by channel, event, user, tag or text." },
  { name: "event_stats", desc: "Total events, unique users, today vs yesterday." },
  { name: "event_timeseries", desc: "Counts per hour or day for a range." },
  { name: "top_breakdown", desc: "Top events, channels or users." },
  { name: "funnel", desc: "Step-by-step conversion between events." },
  { name: "user_journey", desc: "A user's properties and event history." },
  { name: "list_channels", desc: "The project's channels." },
  { name: "list_insights", desc: "The project's KPI tiles." },
  { name: "get_usage", desc: "Plan, events used this month and limits." },
];

export type AgentClient = { id: string; label: string; file?: string; lang: string; code: (url: string, token: string) => string; note?: string };

export const AGENT_CLIENTS: AgentClient[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    lang: "sh",
    code: (url, token) => `claude mcp add --transport http raterlog ${url} \\\n  --header "Authorization: Bearer ${token}"`,
    note: "Add `--scope project` to share it with your team via .mcp.json (use an env var for the token).",
  },
  {
    id: "cursor",
    label: "Cursor",
    file: "~/.cursor/mcp.json",
    lang: "json",
    code: (url, token) =>
      JSON.stringify({ mcpServers: { raterlog: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
  },
  {
    id: "vscode",
    label: "VS Code",
    file: ".vscode/mcp.json",
    lang: "json",
    code: (url, token) =>
      JSON.stringify({ servers: { raterlog: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
  },
  {
    id: "codex",
    label: "Codex",
    file: "~/.codex/config.toml",
    lang: "toml",
    code: (url) => `[mcp_servers.raterlog]\nurl = "${url}"\nbearer_token_env_var = "RATERLOG_TOKEN"`,
    note: "Then export RATERLOG_TOKEN=<your token> in the shell you start Codex from.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    file: "~/.codeium/windsurf/mcp_config.json",
    lang: "json",
    code: (url, token) =>
      JSON.stringify({ mcpServers: { raterlog: { serverUrl: url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
  },
  {
    id: "desktop",
    label: "Claude Desktop",
    file: "claude_desktop_config.json",
    lang: "json",
    code: (url, token) =>
      JSON.stringify(
        { mcpServers: { raterlog: { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${token}`] } } },
        null,
        2,
      ),
    note: "Desktop apps without remote-header support connect through the mcp-remote bridge.",
  },
  {
    id: "raw",
    label: "Any client (HTTP)",
    lang: "sh",
    code: (url, token) =>
      `curl -s ${url} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    note: "Streamable HTTP transport, stateless, JSON responses. GET returns 405 (no server stream).",
  },
];

/** A prompt to paste into a coding agent so it instruments the user's codebase. */
export function instrumentPrompt(base: string, project: string) {
  const example = JSON.stringify(
    {
      project,
      channel: "payments",
      event: "New Subscription",
      description: "Plan **Pro**",
      icon: "💰",
      notify: true,
      tags: { plan: "pro" },
      user_id: "<user id>",
    },
    null,
    2,
  );
  return `Add Raterlog event tracking to this codebase.

Raterlog is a real-time event feed (LogSnag-compatible).
Send events with one HTTP request:

POST ${base}/v1/log
Authorization: Bearer $RATERLOG_TOKEN
Content-Type: application/json
${example}

Also available:
- POST /v1/identify  {"project", "user_id", "properties"}
- POST /v1/insight   {"project", "title", "value", "icon"}
  (PATCH with "value": {"$inc": 1} to increment)

Please:
1. Add a tiny raterlog helper module (no new dependencies; use the
   platform's HTTP client) that reads RATERLOG_TOKEN from the environment.
   It must never throw or block the request path: fire-and-forget with a
   short timeout, and a no-op when the token is missing.
2. Find the 5-10 moments that matter most in this product (signup, login,
   subscription started/cancelled, payment failed, key feature used,
   errors in critical jobs, deploys). Log each with a clear event name,
   a fitting emoji icon, a short description, tags for useful dimensions
   and user_id when known. Group them into a few lowercase channels
   (e.g. signups, payments, errors, ops).
3. Set notify=true only for events a human should be pinged about
   (new paying customer, payment failure, critical error).
4. Call /v1/identify after signup/login with non-sensitive properties
   (name, plan). Never send passwords, tokens or full card data.
5. Add RATERLOG_TOKEN to the env example / config docs.
6. Summarise every event you added and where.`;
}
