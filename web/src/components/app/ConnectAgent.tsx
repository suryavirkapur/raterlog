// "Connect your AI agent" card: MCP config for popular clients with the
// project's real token, plus a prompt that makes a coding agent instrument the app.
import { Callout, Card, H5, Tag } from "@blueprintjs/core";
import { Link } from "@tanstack/react-router";
import { CodeBlock } from "@/components/marketing/CodeBlock";
import { CodeTabs } from "@/components/marketing/CodeTabs";
import { AGENT_CLIENTS, instrumentPrompt } from "@/lib/agents";

export function ConnectAgent({ token, projectName }: { token?: string; projectName: string }) {
  const url = `${location.origin}/mcp`;
  const tok = token || "<create a token first>";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <H5 style={{ margin: 0 }}>Connect your AI agent</H5>
        <Tag minimal intent="primary">MCP</Tag>
      </div>
      <p style={{ margin: 0 }}>
        Let Claude Code, Cursor, Codex or any MCP client log events and answer questions about{" "}
        <strong>{projectName}</strong>. Server: <code>{url}</code> — use a <code>read</code> or{" "}
        <code>full</code> token for the read tools (search, stats, funnels), <code>ingest</code> or{" "}
        <code>full</code> for the write tools.
      </p>
      {!token && (
        <Callout intent="warning" icon="key">
          Create an API token above; the snippets fill it in automatically.
        </Callout>
      )}
      <CodeTabs
        tabs={AGENT_CLIENTS.map((c) => ({
          id: c.id,
          label: c.label,
          code: (c.file ? `# ${c.file}\n` : "") + c.code(url, tok) + (c.note ? `\n\n# ${c.note}` : ""),
        }))}
      />
      <H5 style={{ margin: "8px 0 0" }}>Let your coding agent instrument your app</H5>
      <CodeBlock label="paste into your agent" code={instrumentPrompt(location.origin, projectName)} />
      <p style={{ margin: 0 }}>
        Full guide: <Link to="/docs/agents">Raterlog for AI agents</Link>
      </p>
    </Card>
  );
}
