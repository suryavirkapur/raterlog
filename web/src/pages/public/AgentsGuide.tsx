import { HTMLTable, Tag } from "@blueprintjs/core";
import { Link } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CodeBlock } from "@/components/marketing/CodeBlock";
import { CodeTabs } from "@/components/marketing/CodeTabs";
import { AGENT_CLIENTS, MCP_TOOLS, instrumentPrompt } from "@/lib/agents";

const base = typeof location !== "undefined" ? location.origin : "https://raterlog.com";
const MCP_URL = `${base}/mcp`;
const TOKEN = "<YOUR_API_TOKEN>";

export default function AgentsGuide() {
  return (
    <div className="rl-page">
      <MarketingNav />
      <main className="rl-wrap rl-docs" style={{ flex: 1 }}>
        <h1>Raterlog for AI agents</h1>
        <p>
          Raterlog ships a remote <strong>MCP server</strong> at <code>{MCP_URL}</code>. Connect Claude Code,
          Cursor, Codex, VS Code or any MCP client and your agent can <em>log</em> events (deploys, finished
          tasks, errors it hit) and <em>ask</em> what's happening in your product: recent signups, failed
          payments, funnels, a user's journey.
        </p>
        <nav className="rl-docs-nav" aria-label="Sections">
          {[
            ["#token", "1. Get a token"],
            ["#connect", "2. Connect your agent"],
            ["#tools", "Tools"],
            ["#instrument", "Instrument your code"],
            ["#examples", "Things to ask"],
          ].map(([href, label]) => (
            <a key={href} href={href}>
              <Tag minimal interactive>
                {label}
              </Tag>
            </a>
          ))}
        </nav>

        <section id="token">
          <h2>1. Get a project API token</h2>
          <p>
            <Link to="/signup" search={{ email: "", invite: "" }}>Create an account</Link>, create a project, then
            open <strong>Settings → API tokens</strong>. One token = one project: the MCP connection only sees and
            writes that project. The in-app <strong>Setup guide</strong> shows every snippet below with your real
            token filled in.
          </p>
        </section>

        <section id="connect">
          <h2>2. Connect your agent</h2>
          <p>
            Transport: Streamable HTTP, URL <code>{MCP_URL}</code>, header{" "}
            <code>Authorization: Bearer &lt;token&gt;</code>.
          </p>
          <CodeTabs
            tabs={AGENT_CLIENTS.map((c) => ({
              id: c.id,
              label: c.label,
              code: (c.file ? `# ${c.file}\n` : "") + c.code(MCP_URL, TOKEN) + (c.note ? `\n\n# ${c.note}` : ""),
            }))}
          />
        </section>

        <section id="tools">
          <h2>Tools</h2>
          <HTMLTable compact striped style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Kind</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {MCP_TOOLS.map((t) => (
                <tr key={t.name}>
                  <td>
                    <code>{t.name}</code>
                  </td>
                  <td>
                    <Tag minimal intent={t.write ? "warning" : "none"}>
                      {t.write ? "write" : "read"}
                    </Tag>
                  </td>
                  <td>{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          <p>Ranges are <code>24h</code>, <code>7d</code>, <code>30d</code> or <code>90d</code>. Channels are created on first use.</p>
        </section>

        <section id="instrument">
          <h2>Have your coding agent instrument your app</h2>
          <p>
            Paste this into Claude Code, Cursor or Codex inside your repo. It adds a tiny dependency-free helper
            and logs the moments that matter. Replace <code>my-saas</code> with your project name.
          </p>
          <CodeBlock label="prompt" code={instrumentPrompt(base, "my-saas")} />
        </section>

        <section id="examples">
          <h2>Things to ask once connected</h2>
          <ul>
            <li>"What happened in the last 24 hours? Anything unusual?"</li>
            <li>"Show me failed payments this week and which plans they were on."</li>
            <li>"What's our signup → subscription conversion over 30 days?"</li>
            <li>"What did user_123 do before they churned?"</li>
            <li>"Log a deploy event in #ops when you finish this release, and notify me."</li>
          </ul>
          <p>
            Prefer plain HTTP? See the <Link to="/docs">API quickstart</Link>. Machine-readable summary:{" "}
            <a href="/llms.txt">/llms.txt</a>.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
