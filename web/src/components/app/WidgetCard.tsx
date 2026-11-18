import type { ReactNode } from "react";
import {
  Button,
  Card,
  Classes,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  NonIdealState,
  Popover,
  type IconName,
} from "@blueprintjs/core";
import { analytics, type DashboardWidget, type Range } from "@/lib/api";
import { useProject } from "@/lib/context";
import { useAsync } from "@/lib/hooks";
import { BreakdownBar } from "./BreakdownBar";
import { EventsChart } from "./EventsChart";
import { FunnelBars } from "./FunnelBars";
import { RelativeTime } from "./RelativeTime";
import { errMsg, fmtNum } from "./util";

export const WIDGET_KIND_LABELS: Record<DashboardWidget["kind"], string> = {
  timeseries: "Events over time",
  breakdown: "Top breakdown",
  funnel: "Conversion funnel",
  insight: "Insight",
  event_count: "Event count",
};

const KIND_ICONS: Record<DashboardWidget["kind"], IconName> = {
  timeseries: "timeline-line-chart",
  breakdown: "horizontal-bar-chart-desc",
  funnel: "filter",
  insight: "lightbulb",
  event_count: "pulse",
};

/** One tile on a dashboard: title bar with actions + a body rendered per kind. */
export function WidgetCard({
  projectId,
  widget,
  range,
  x,
  y,
  first,
  last,
  onEdit,
  onMove,
  onDelete,
}: {
  projectId: string;
  widget: DashboardWidget;
  range: Range;
  x: number;
  y: number;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const cfg = widget.config;
  const w = cfg.w ?? 6;
  const h = cfg.h ?? 3;
  return (
    <Card
      compact
      className="rl-widget"
      style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` }}
    >
      <div className="rl-widget-head">
        <div className="rl-widget-title">
          <Icon icon={KIND_ICONS[widget.kind] ?? "blank"} size={12} />
          <span title={widget.title}>{widget.title}</span>
        </div>
        <Popover
          minimal
          placement="bottom-end"
          content={
            <Menu>
              <MenuItem icon="edit" text="Edit" onClick={onEdit} />
              <MenuDivider />
              <MenuItem icon="arrow-up" text="Move up" disabled={first} onClick={() => onMove(-1)} />
              <MenuItem icon="arrow-down" text="Move down" disabled={last} onClick={() => onMove(1)} />
              <MenuDivider />
              <MenuItem icon="trash" text="Delete" intent="danger" onClick={onDelete} />
            </Menu>
          }
        >
          <Button minimal small icon="more" aria-label={`Options for ${widget.title}`} />
        </Popover>
      </div>
      <div className="rl-widget-body">
        <WidgetBody projectId={projectId} widget={widget} range={range} />
      </div>
    </Card>
  );
}

function BodyState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: Error | null;
  empty?: boolean;
  children: ReactNode;
}) {
  if (error)
    return (
      <NonIdealState icon="error" title="Couldn't load data" description={errMsg(error)} layout="horizontal" />
    );
  if (loading) return <div className={Classes.SKELETON} style={{ flex: 1, borderRadius: 6 }} />;
  if (empty) return <NonIdealState icon="pulse" title="No data for this range" layout="horizontal" />;
  return <>{children}</>;
}

function WidgetBody({
  projectId,
  widget,
  range,
}: {
  projectId: string;
  widget: DashboardWidget;
  range: Range;
}) {
  const cfg = widget.config;
  switch (widget.kind) {
    case "timeseries":
      return <TimeseriesBody projectId={projectId} range={range} channel={cfg.channel} event={cfg.event} interval={cfg.interval} />;
    case "breakdown":
      return <BreakdownBody projectId={projectId} range={range} by={cfg.by} channel={cfg.channel} limit={cfg.limit} />;
    case "funnel":
      return <FunnelBody projectId={projectId} range={range} steps={cfg.steps} windowHours={cfg.window_hours} />;
    case "insight":
      return <InsightBody title={cfg.insight ?? widget.title} />;
    case "event_count":
      return <EventCountBody projectId={projectId} range={range} />;
    default:
      return <NonIdealState icon="warning-sign" title={`Unknown widget kind`} layout="horizontal" />;
  }
}

function TimeseriesBody({
  projectId,
  range,
  channel,
  event,
  interval,
}: {
  projectId: string;
  range: Range;
  channel?: string;
  event?: string;
  interval?: "hour" | "day";
}) {
  const hourly = interval ? interval === "hour" : range === "24h";
  const req = useAsync(
    () =>
      analytics.timeseries(projectId, {
        range,
        interval: hourly ? "hour" : "day",
        channel: channel || undefined,
        event: event || undefined,
      }),
    [projectId, range, hourly, channel, event],
    { pollMs: 60_000 },
  );
  return (
    <BodyState loading={req.loading} error={req.error} empty={!req.data?.length}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EventsChart data={req.data ?? []} hourly={hourly} />
      </div>
    </BodyState>
  );
}

function BreakdownBody({
  projectId,
  range,
  by,
  channel,
  limit,
}: {
  projectId: string;
  range: Range;
  by?: "event" | "channel" | "user";
  channel?: string;
  limit?: number;
}) {
  const req = useAsync(
    () =>
      analytics.breakdown(projectId, {
        range,
        by: by ?? "event",
        channel: channel || undefined,
        limit: limit ?? 10,
      }),
    [projectId, range, by, channel, limit],
    { pollMs: 60_000 },
  );
  return (
    <BodyState loading={req.loading} error={req.error} empty={!req.data?.length}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {(req.data ?? []).map((r) => (
          <BreakdownBar key={r.key} row={r} max={req.data?.[0]?.count ?? 1} />
        ))}
      </div>
    </BodyState>
  );
}

function FunnelBody({
  projectId,
  range,
  steps,
  windowHours,
}: {
  projectId: string;
  range: Range;
  steps?: string[];
  windowHours?: number;
}) {
  const list = steps ?? [];
  const valid = list.length >= 2;
  const req = useAsync(
    () =>
      valid
        ? analytics.funnel(projectId, { steps: list, range, window_hours: windowHours ?? 168 })
        : Promise.resolve([]),
    [projectId, range, valid, list.join("|"), windowHours],
    { pollMs: 60_000 },
  );
  if (!valid)
    return <NonIdealState icon="filter" title="Needs at least 2 steps" description="Edit the widget to pick funnel steps." layout="horizontal" />;
  return (
    <BodyState loading={req.loading} error={req.error} empty={!req.data?.length}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <FunnelBars steps={req.data ?? []} />
      </div>
    </BodyState>
  );
}

function InsightBody({ title }: { title: string }) {
  const { detail } = useProject();
  const ins = detail.insights.find((i) => i.title === title);
  if (!ins)
    return (
      <NonIdealState
        icon="lightbulb"
        title="Insight not found"
        description={`No insight named "${title}".`}
        layout="horizontal"
      />
    );
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <span className="rl-insight-icon">{ins.icon?.trim() || "📈"}</span>
      <div className="rl-insight-value">{ins.value}</div>
      <div className="rl-stat-sub">
        updated <RelativeTime iso={ins.updatedAt} />
      </div>
    </div>
  );
}

function EventCountBody({ projectId, range }: { projectId: string; range: Range }) {
  const req = useAsync(() => analytics.summary(projectId, range), [projectId, range], { pollMs: 60_000 });
  return (
    <BodyState loading={req.loading} error={req.error}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="rl-insight-value">{fmtNum(req.data?.total ?? 0)}</div>
        <div className="rl-stat-sub">
          {fmtNum(req.data?.unique_users ?? 0)} unique users · last {range}
        </div>
      </div>
    </BodyState>
  );
}
