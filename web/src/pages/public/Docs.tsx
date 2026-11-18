import { Button, Callout, HTMLTable, Tag } from "@blueprintjs/core";
import { INGEST_DOCS } from "@/lib/plans";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CodeTabs, type CodeTab } from "@/components/marketing/CodeTabs";
import { CodeBlock } from "@/components/marketing/CodeBlock";
import "@/components/marketing/marketing.css";

const base = INGEST_DOCS.base;
const TOKEN = "rl_your_token";

/** Build curl / JS / Python snippets for one endpoint. */
function snippets(method: "POST" | "PATCH", path: string, body: object): CodeTab[] {
  const json = JSON.stringify(body, null, 2);
  return [
    {
      id: "curl",
      label: "curl",
      code: `curl -X ${method} ${base}${path} \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '${json.replace(/\n/g, "\n  ")}'`,
    },
    {
      id: "js",
      label: "JavaScript",
      code: `await fetch("${base}${path}", {
  method: "${method}",
  headers: {
    "Authorization": "Bearer ${TOKEN}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${json}),
});`,
    },
    {
      id: "py",
      label: "Python",
      code: `import requests

requests.request(
    "${method}",
    "${base}${path}",
    headers={"Authorization": "Bearer ${TOKEN}"},
    json=${json
      .replace(/true/g, "True")
      .replace(/false/g, "False")
      .replace(/null/g, "None")},
)`,
    },
  ];
}

function FieldTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <div className="rl-table-wrap">
      <HTMLTable compact bordered style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([f, t, r, d]) => (
            <tr key={f}>
              <td>
                <code>{f}</code>
              </td>
              <td>
                <code>{t}</code>
              </td>
              <td>{r}</td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="rl-page">
      <MarketingNav />
      <main className="rl-wrap rl-docs" style={{ flex: 1 }}>
        <h1>Quickstart</h1>
        <p>
          Raterlog's ingestion API is four endpoints. Create an API token in your project's{" "}
          <strong>Settings → API tokens</strong>, then POST events from anywhere. All requests go to{" "}
          <code>{base}</code> — the same origin as this page.
        </p>
        <nav className="rl-docs-nav" aria-label="Sections">
          {[
            ["#auth", "Authentication"],
            ["#log", "POST /v1/log"],
            ["#identify", "POST /v1/identify"],
            ["#insight", "Insights"],
            ["#errors", "Errors"],
            ["/docs/agents", "AI agents & MCP →"],
          ].map(([href, label]) => (
            <a key={href} href={href}>
              <Tag minimal interactive>
                {label}
              </Tag>
            </a>
          ))}
        </nav>

        <section id="auth">
          <h2>Authentication</h2>
          <p>
            Every request carries a project API token as a Bearer token. Tokens are created per
            project in <strong>Settings → API tokens</strong> and look like{" "}
            <code>rl_…</code>. Keep them server-side — an <code>ingest</code> or <code>full</code>{" "}
            token can write events for its project (<code>read</code> tokens can only query it).
          </p>
          <CodeBlock label="header" code={`Authorization: Bearer ${TOKEN}`} />
        </section>

        <section id="log">
          <h2>
            POST <code>/v1/log</code>
          </h2>
          <p>
            Record an event. <code>project</code> is the project name exactly as it appears in the
            dashboard. Channels are created automatically the first time you send to one. Set{" "}
            <code>notify</code> to <code>true</code> to trigger a push notification.
          </p>
          <FieldTable
            rows={[
              ["project", "string", "yes", "Project name, e.g. \"my-saas\""],
              ["channel", "string", "yes", "Channel name; created on first use"],
              ["event", "string", "yes", "What happened, e.g. \"New Subscription\""],
              ["description", "string", "no", "Longer detail; markdown is fine"],
              ["icon", "string", "no", "Emoji shown in the feed, e.g. 💰"],
              ["notify", "boolean", "no", "Send a push notification (default false)"],
              ["user_id", "string", "no", "Your user's id — links the event to their journey"],
              ["tags", "object", "no", "String→string metadata, searchable from the feed"],
            ]}
          />
          <CodeTabs
            tabs={snippets("POST", "/v1/log", {
              project: "my-saas",
              channel: "payments",
              event: "New Subscription",
              description: "jane@acme.com · plan: pro",
              icon: "💰",
              notify: true,
              tags: { plan: "pro", cycle: "yearly" },
              user_id: "user_123",
            })}
          />
        </section>

        <section id="identify">
          <h2>
            POST <code>/v1/identify</code>
          </h2>
          <p>
            Attach a profile to a <code>user_id</code> — name, email, plan, anything. Subsequent
            events with the same <code>user_id</code> are stitched into that user's journey.
          </p>
          <FieldTable
            rows={[
              ["project", "string", "yes", "Project name"],
              ["user_id", "string", "yes", "The id you pass as user_id in /v1/log"],
              ["properties", "object", "yes", "Arbitrary profile fields"],
            ]}
          />
          <CodeTabs
            tabs={snippets("POST", "/v1/identify", {
              project: "my-saas",
              user_id: "user_123",
              properties: { name: "Jane", email: "jane@acme.com", plan: "pro" },
            })}
          />
        </section>

        <section id="insight">
          <h2>Insights</h2>
          <p>
            Insights are live KPIs pinned to your dashboard — MRR, signups today, active users.
            <code> POST /v1/insight</code> sets a value; <code>PATCH /v1/insight</code> adjusts a
            numeric value atomically with <code>$inc</code>, which is the right way to track
            counters from many workers.
          </p>
          <FieldTable
            rows={[
              ["project", "string", "yes", "Project name"],
              ["title", "string", "yes", "Insight name, e.g. \"MRR\""],
              ["value", "string | number | { $inc: n }", "yes", "Set (POST) or adjust (PATCH)"],
              ["icon", "string", "no", "Emoji shown next to the value"],
            ]}
          />
          <h3>
            Set a value — <code>POST</code>
          </h3>
          <CodeTabs
            tabs={snippets("POST", "/v1/insight", {
              project: "my-saas",
              title: "MRR",
              value: "$12,480",
              icon: "💸",
            })}
          />
          <h3>
            Increment a counter — <code>PATCH</code>
          </h3>
          <CodeTabs
            tabs={snippets("PATCH", "/v1/insight", {
              project: "my-saas",
              title: "Signups today",
              value: { $inc: 1 },
              icon: "🙋",
            })}
          />
        </section>

        <section id="errors">
          <h2>Errors</h2>
          <p>
            Non-2xx responses return a JSON body with an <code>error</code> message —{" "}
            <code>401</code> for a missing or bad token, <code>404</code> for an unknown project,{" "}
            <code>422</code> for a malformed body.
          </p>
          <CodeBlock label="response" code={`{ "error": "invalid api token" }`} />
          <Callout icon="info-sign" style={{ marginTop: 16 }}>
            Sending test events from a script? Point it at <code>{base}</code> — no extra
            configuration needed.
          </Callout>
        </section>

        <div style={{ marginTop: 48 }}>
          <a href="#top">
            <Button minimal icon="arrow-up" text="Back to top" />
          </a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
