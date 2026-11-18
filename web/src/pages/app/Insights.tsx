import { useEffect } from "react";
import { Button, Callout, Card, NonIdealState } from "@blueprintjs/core";
import { useProject } from "@/lib/context";
import { INGEST_DOCS } from "@/lib/plans";
import { PageHeader } from "@/components/app/PageHeader";
import { RelativeTime } from "@/components/app/RelativeTime";
import { copyText } from "@/components/app/util";

const snippet = (doc: { method: string; path: string; body: unknown }) =>
  `curl -X ${doc.method} '${INGEST_DOCS.base}${doc.path}' \\
  -H '${INGEST_DOCS.auth}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(doc.body, null, 1)}'`;

export default function Insights() {
  const { detail, reload } = useProject();
  const insights = detail.insights;

  // KPI values can change at any time via PATCH $inc — refresh quietly.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 10_000);
    return () => clearInterval(id);
  }, [reload]);

  return (
    <div className="rl-page rl-page-data">
      <PageHeader
        title="Insights"
        subtitle="Live KPIs your app pushes with one HTTP call"
        actions={<Button small minimal icon="refresh" text="Refresh" onClick={() => void reload()} />}
      />
      {insights.length === 0 ? (
        <Card>
          <NonIdealState
            icon="predictive-analysis"
            title="No insights yet"
            description="Publish a KPI from your backend — set a value with POST, or increment a counter with PATCH and $inc."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            <div>
              <div className="rl-stat-label" style={{ marginBottom: 6 }}>
                Set a value — POST /v1/insight
              </div>
              <pre className="rl-pre">{snippet(INGEST_DOCS.insight)}</pre>
            </div>
            <div>
              <div className="rl-stat-label" style={{ marginBottom: 6 }}>
                Increment a counter — PATCH /v1/insight
              </div>
              <pre className="rl-pre">{snippet(INGEST_DOCS.insightInc)}</pre>
            </div>
          </div>
          <Callout compact style={{ marginTop: 12, fontSize: 12.5 }}>
            {INGEST_DOCS.note}
          </Callout>
        </Card>
      ) : (
        <>
          <div className="rl-insight-grid">
            {insights.map((ins) => (
              <Card key={ins.id} compact>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span className="rl-insight-icon">{ins.icon?.trim() || "📈"}</span>
                  <Button
                    small
                    minimal
                    icon="duplicate"
                    title="Copy value"
                    onClick={() => copyText(ins.value, `"${ins.title}" copied`)}
                  />
                </div>
                <div className="rl-insight-title">{ins.title}</div>
                <div className="rl-insight-value">{ins.value}</div>
                <div className="rl-stat-sub">
                  updated <RelativeTime iso={ins.updatedAt} />
                </div>
              </Card>
            ))}
          </div>
          <Card style={{ marginTop: 16 }}>
            <div className="rl-stat-label" style={{ marginBottom: 10 }}>
              Update these from your backend
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
              <div>
                <div className="rl-stat-sub" style={{ marginBottom: 6 }}>
                  Set a value — POST /v1/insight
                </div>
                <pre className="rl-pre">{snippet(INGEST_DOCS.insight)}</pre>
              </div>
              <div>
                <div className="rl-stat-sub" style={{ marginBottom: 6 }}>
                  Increment a counter — PATCH /v1/insight
                </div>
                <pre className="rl-pre">{snippet(INGEST_DOCS.insightInc)}</pre>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
