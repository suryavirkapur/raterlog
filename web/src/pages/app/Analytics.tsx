import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Button,
  Card,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  InputGroup,
  MenuItem,
  NonIdealState,
  NumericInput,
  Tag,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analytics, type BreakdownRow, type FunnelStep, type Range } from "@/lib/api";
import { useProject } from "@/lib/context";
import { useAsync, useLocalState } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";
import { PageHeader } from "@/components/app/PageHeader";
import { StatTile } from "@/components/app/StatTile";
import { RangeSelect } from "@/components/app/RangeSelect";
import { ChartCard } from "@/components/app/ChartCard";
import { CHART, CHART_TOOLTIP_STYLE } from "@/components/app/chartTheme";
import { errMsg, fmtNum } from "@/components/app/util";

type SavedFunnel = { name: string; steps: string[]; window_hours: number };

export default function Analytics() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { detail } = useProject();
  const [range, setRange] = useLocalState<Range>("rl-analytics-range", "7d");
  const [channel, setChannel] = useState("");
  const [eventName, setEventName] = useState("");

  const interval = range === "24h" ? "hour" : "day";

  const series = useAsync(
    () =>
      analytics.timeseries(projectId, {
        range,
        interval,
        channel: channel || undefined,
        event: eventName || undefined,
      }),
    [projectId, range, interval, channel, eventName],
    { pollMs: 30_000 },
  );
  // Exact totals for the range (+ today / yesterday) for the KPI tiles.
  const summary = useAsync(() => analytics.summary(projectId, range), [projectId, range], {
    pollMs: 30_000,
  });
  const byEvent = useAsync(() => analytics.breakdown(projectId, { range, by: "event", limit: 15 }), [projectId, range], {
    pollMs: 30_000,
  });
  const byChannel = useAsync(
    () => analytics.breakdown(projectId, { range, by: "channel", limit: 15 }),
    [projectId, range],
    { pollMs: 30_000 },
  );
  const byUser = useAsync(() => analytics.breakdown(projectId, { range, by: "user", limit: 15 }), [projectId, range], {
    pollMs: 30_000,
  });

  const dayDelta = useMemo(() => {
    if (!summary.data) return undefined;
    const { today: todayCount, yesterday: yestCount } = summary.data;
    return {
      today: todayCount,
      yesterday: yestCount,
      pct: yestCount === 0 ? (todayCount > 0 ? 100 : NaN) : ((todayCount - yestCount) / yestCount) * 100,
    };
  }, [summary.data]);

  const eventOptions = useMemo(() => (byEvent.data ?? []).map((r) => r.key), [byEvent.data]);

  const tickFmt = (t: string) => {
    const d = new Date(t);
    return interval === "hour"
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="rl-page rl-page-data">
      <PageHeader
        title="Analytics"
        subtitle={`${detail.company.name} — last ${range}`}
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="rl-stats">
        <StatTile icon="pulse" label="Total events" value={summary.data?.total} loading={summary.loading} />
        <StatTile icon="people" label="Unique users" value={summary.data?.unique_users} loading={summary.loading} />
        <StatTile
          icon="calendar"
          label="Events today"
          value={dayDelta?.today}
          loading={summary.loading}
          sub={`${fmtNum(dayDelta?.yesterday ?? 0)} yesterday`}
          delta={dayDelta ? { pct: dayDelta.pct, against: "vs yesterday" } : undefined}
        />
        <StatTile
          icon="star"
          label="Top event"
          value={byEvent.data?.[0]?.key ?? undefined}
          loading={byEvent.loading}
          sub={byEvent.data?.[0] ? `${fmtNum(byEvent.data[0].count)} events` : undefined}
        />
      </div>

      <ChartCard
        title="Events over time"
        loading={series.loading}
        error={series.error ? errMsg(series.error) : null}
        empty={!series.data?.length}
        height={280}
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <HTMLSelect
              minimal
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={[
                { value: "", label: "All channels" },
                ...detail.channels.map((c) => ({ value: c.id, label: `${c.icon?.trim() || "#"} ${c.name}` })),
              ]}
            />
            <HTMLSelect
              minimal
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              options={[{ value: "", label: "All events" }, ...eventOptions.map((n) => ({ value: n, label: n }))]}
            />
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series.data ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={tickFmt}
              tick={{ fontSize: 11, fill: "currentColor" }}
              stroke={CHART.tick}
              minTickGap={40}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "currentColor" }}
              stroke={CHART.tick}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(v) => [fmtNum(Number(v)), "events"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={CHART.primary}
              strokeWidth={2}
              fill={CHART.primarySoft}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rl-analytics-lower">
        <div className="rl-breakdown-grid">
          <BreakdownCard title="By event" rows={byEvent.data} loading={byEvent.loading} error={byEvent.error} onPick={setEventName} />
          <BreakdownCard title="By channel" rows={byChannel.data} loading={byChannel.loading} error={byChannel.error} />
          <BreakdownCard title="By user" rows={byUser.data} loading={byUser.loading} error={byUser.error} />
        </div>
        <FunnelBuilder projectId={projectId} range={range} eventOptions={eventOptions} />
      </div>
    </div>
  );
}

const BREAKDOWN_CAP = 8;

function BreakdownCard({
  title,
  rows,
  loading,
  error,
  onPick,
}: {
  title: string;
  rows?: BreakdownRow[];
  loading: boolean;
  error: Error | null;
  onPick?: (key: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows?.slice(0, BREAKDOWN_CAP);
  const hidden = (rows?.length ?? 0) - (shown?.length ?? 0);
  return (
    <Card compact>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>
      {loading ? (
        <div className={Classes.SKELETON} style={{ height: 120, borderRadius: 6 }} />
      ) : error ? (
        <NonIdealState icon="error" title="Unavailable" description={errMsg(error)} layout="horizontal" />
      ) : !shown?.length ? (
        <div className="rl-muted" style={{ fontSize: 13, padding: "12px 0" }}>
          No data for this range
        </div>
      ) : (
        <div>
          {shown.map((r) => (
            <BreakdownBar key={r.key} row={r} max={rows![0]!.count} onPick={onPick} />
          ))}
          {(hidden > 0 || showAll) && (
            <Button
              className="rl-breakdown-more"
              small
              minimal
              icon={showAll ? "chevron-up" : "chevron-down"}
              text={showAll ? "Show less" : `Show all ${rows!.length}`}
              onClick={() => setShowAll((v) => !v)}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function BreakdownBar({ row, max, onPick }: { row: BreakdownRow; max: number; onPick?: (key: string) => void }) {
  return (
    <div
      className="rl-bar-row"
      style={onPick ? { cursor: "pointer" } : undefined}
      onClick={onPick ? () => onPick(row.key) : undefined}
      title={onPick ? `Filter chart to "${row.key}"` : row.key}
    >
      <div className="rl-bar-key">{row.key}</div>
      <div className="rl-bar-track">
        <div className="rl-bar-fill" style={{ width: `${Math.max((row.count / Math.max(max, 1)) * 100, 2)}%` }} />
      </div>
      <div className="rl-bar-count">{fmtNum(row.count)}</div>
    </div>
  );
}

function FunnelBuilder({
  projectId,
  range,
  eventOptions,
}: {
  projectId: string;
  range: Range;
  eventOptions: string[];
}) {
  const [saved, setSaved] = useLocalState<SavedFunnel[]>(`rl-funnels-${projectId}`, []);
  const [steps, setSteps] = useState<string[]>([]);
  const [windowHours, setWindowHours] = useState(24);
  const [result, setResult] = useState<FunnelStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const run = async (s = steps, wh = windowHours) => {
    if (s.length < 2) {
      void toast({ message: "Pick at least two steps", intent: "warning", icon: "warning-sign" });
      return;
    }
    setRunning(true);
    try {
      setResult(await analytics.funnel(projectId, { steps: s, range, window_hours: wh }));
    } catch (e) {
      toastError(e, "Couldn't compute funnel");
    } finally {
      setRunning(false);
    }
  };

  const load = (f: SavedFunnel) => {
    setSteps(f.steps);
    setWindowHours(f.window_hours);
    void run(f.steps, f.window_hours);
  };

  const first = result?.[0]?.count ?? 0;

  return (
    <Card compact>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Funnels</div>
      <div className="rl-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        Pick 2–6 events in order to see conversion between steps.
      </div>

      {saved.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {saved.map((f, i) => (
            <Tag
              key={i}
              interactive
              minimal
              icon="filter"
              onRemove={() => setSaved(saved.filter((_, j) => j !== i))}
              onClick={() => load(f)}
              title={`${f.steps.join(" → ")} (${f.window_hours}h window)`}
            >
              {f.name}
            </Tag>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 320px", minWidth: 240 }}>
          <MultiSelect<string>
            items={eventOptions}
            itemPredicate={(q, item) => item.toLowerCase().includes(q.toLowerCase())}
            itemRenderer={(item, { handleClick, modifiers }) => (
              <MenuItem
                key={item}
                text={item}
                onClick={handleClick}
                active={modifiers.active}
                icon={steps.includes(item) ? "small-tick" : "blank"}
                shouldDismissPopover={false}
              />
            )}
            selectedItems={steps}
            tagRenderer={(s) => s}
            onItemSelect={(item) =>
              setSteps((prev) =>
                prev.includes(item) ? prev.filter((s) => s !== item) : prev.length < 6 ? [...prev, item] : prev,
              )
            }
            onRemove={(item) => setSteps((prev) => prev.filter((s) => s !== item))}
            onClear={() => setSteps([])}
            placeholder="Pick 2–6 event names…"
            fill
            popoverProps={{ minimal: true }}
            noResults={<MenuItem disabled text="No matching events" />}
            resetOnSelect
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <NumericInput
            small
            min={1}
            max={720}
            value={windowHours}
            onValueChange={(v) => setWindowHours(Number.isFinite(v) ? v : 24)}
            style={{ width: 70 }}
            buttonPosition="none"
          />
          <span className="rl-muted" style={{ fontSize: 12 }}>
            hour window
          </span>
        </div>
        <Button
          small
          intent="primary"
          icon="filter-list"
          text="Run funnel"
          loading={running}
          disabled={steps.length < 2}
          onClick={() => void run()}
        />
        <Button
          small
          minimal
          icon="floppy-disk"
          text="Save"
          disabled={steps.length < 2}
          onClick={() => setSaveOpen(true)}
        />
      </div>

      {running && <div className={Classes.SKELETON} style={{ height: 140, marginTop: 14, borderRadius: 6 }} />}
      {!running && result && (
        <div style={{ marginTop: 16 }}>
          {result.map((s, i) => {
            const pct = first > 0 ? (s.count / first) * 100 : 0;
            const prev = i > 0 ? result[i - 1]!.count : null;
            const drop = prev != null && prev > 0 ? ((prev - s.count) / prev) * 100 : 0;
            return (
              <div key={i} className="rl-funnel-step">
                {i > 0 && (
                  <div className="rl-funnel-meta">
                    <span>↓ {drop.toFixed(1)}% dropped off</span>
                  </div>
                )}
                <div className="rl-funnel-bar" style={{ width: `${Math.max(pct, 8)}%` }}>
                  {s.event}
                </div>
                <div className="rl-funnel-meta">
                  <span>
                    {fmtNum(s.count)} · {pct.toFixed(1)}% of first step
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!running && result?.length === 0 && (
        <div className="rl-muted" style={{ marginTop: 14, fontSize: 13 }}>
          No events matched these steps in the selected range.
        </div>
      )}

      <Dialog
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save funnel"
        icon="floppy-disk"
        style={{ width: 380 }}
      >
        <div className={Classes.DIALOG_BODY}>
          <FormGroup label="Name" labelFor="funnel-name">
            <InputGroup
              id="funnel-name"
              autoFocus
              placeholder="e.g. Signup → Paid"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </FormGroup>
          <div className="rl-muted" style={{ fontSize: 12 }}>
            {steps.join(" → ")} · {windowHours}h window
          </div>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text="Cancel" onClick={() => setSaveOpen(false)} />
            <Button
              intent="primary"
              text="Save funnel"
              disabled={!saveName.trim()}
              onClick={() => {
                setSaved([...saved, { name: saveName.trim(), steps, window_hours: windowHours }]);
                setSaveOpen(false);
                setSaveName("");
                void toast({ message: "Funnel saved", intent: "success", icon: "tick" });
              }}
            />
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
