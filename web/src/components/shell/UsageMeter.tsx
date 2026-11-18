import { Link } from "@tanstack/react-router";
import { Button, ProgressBar, Tag } from "@blueprintjs/core";
import type { Usage } from "@/lib/api";

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/** Events usage meter for the sidebar footer. Hidden when data is unavailable. */
export function UsageMeter({ projectId, usage }: { projectId: string; usage?: Usage | null }) {
  if (!usage) return null;
  const unlimited = usage.events_limit < 0;
  const pct = unlimited ? 0 : Math.min(1, usage.events_used / usage.events_limit);
  const hot = !unlimited && usage.events_used / usage.events_limit > 0.8;
  return (
    <div className="rl-usage">
      <div className="rl-usage-head">
        <span className="rl-usage-label">Events this period</span>
        <Tag minimal round>
          {usage.plan}
        </Tag>
      </div>
      <ProgressBar
        value={pct}
        intent={hot ? "warning" : "primary"}
        stripes={usage.events_used >= usage.events_limit && !unlimited}
      />
      <div className="rl-usage-nums">
        <span>{fmt(usage.events_used)} used</span>
        <span>{unlimited ? "unlimited" : fmt(usage.events_limit)}</span>
      </div>
      {hot && (
        <Link to="/app/$projectId/settings" params={{ projectId }} search={{ tab: "billing" }}>
          <Button small fill intent="warning" text="Upgrade plan" icon="trending-up" />
        </Link>
      )}
    </div>
  );
}
