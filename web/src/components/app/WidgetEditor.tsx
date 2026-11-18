import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  InputGroup,
  MenuItem,
  NumericInput,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import {
  analytics,
  dashboards,
  type DashboardWidget,
  type WidgetConfig,
  type WidgetKind,
} from "@/lib/api";
import { useProject } from "@/lib/context";
import { useAsync } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";
import { WIDGET_KIND_LABELS } from "./WidgetCard";

const WIDTHS = [
  { value: 4, label: "Third" },
  { value: 6, label: "Half" },
  { value: 8, label: "Two thirds" },
  { value: 12, label: "Full width" },
];
const HEIGHTS = [
  { value: 2, label: "Short" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Tall" },
];

function isCompact(kind: WidgetKind) {
  return kind === "insight" || kind === "event_count";
}

/** Create/edit dialog for a dashboard widget. Kind-specific fields map 1:1 to the analytics endpoints' params. */
export function WidgetEditor({
  isOpen,
  onClose,
  projectId,
  dashboardId,
  widget,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  dashboardId: string;
  /** null = creating a new widget. */
  widget: DashboardWidget | null;
  onSaved: (w: DashboardWidget) => void;
}) {
  const { detail } = useProject();
  const [kind, setKind] = useState<WidgetKind>("timeseries");
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [event, setEvent] = useState("");
  const [interval, setInterval_] = useState("");
  const [by, setBy] = useState<"event" | "channel" | "user">("event");
  const [limit, setLimit] = useState(10);
  const [steps, setSteps] = useState<string[]>([]);
  const [windowHours, setWindowHours] = useState(168);
  const [insight, setInsight] = useState("");
  const [w, setW] = useState(6);
  const [h, setH] = useState(3);
  const [busy, setBusy] = useState(false);

  // Event names for the event pickers, from the top-events breakdown.
  const eventsReq = useAsync(
    () => analytics.breakdown(projectId, { range: "90d", by: "event", limit: 50 }),
    [projectId],
  );
  const eventOptions = useMemo(() => {
    const names = new Set((eventsReq.data ?? []).map((r) => r.key));
    if (event) names.add(event);
    for (const s of steps) names.add(s);
    return [...names];
  }, [eventsReq.data, event, steps]);

  useEffect(() => {
    if (!isOpen) return;
    const c = widget?.config ?? {};
    const k = widget?.kind ?? "timeseries";
    setKind(k);
    setTitle(widget?.title ?? "");
    setChannel(c.channel ?? "");
    setEvent(c.event ?? "");
    setInterval_(c.interval ?? "");
    setBy(c.by ?? "event");
    setLimit(c.limit ?? 10);
    setSteps(c.steps ?? []);
    setWindowHours(c.window_hours ?? 168);
    setInsight(c.insight ?? detail.insights[0]?.title ?? "");
    setW(c.w ?? 6);
    setH(c.h ?? (isCompact(k) ? 2 : 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, widget]);

  function pickKind(k: WidgetKind) {
    setKind(k);
    if (!widget) setH(isCompact(k) ? 2 : 3);
    if (!title || title === WIDGET_KIND_LABELS[kind]) setTitle(k === "insight" && insight ? insight : WIDGET_KIND_LABELS[k]);
  }

  const channelOptions = [
    { value: "", label: "All channels" },
    ...detail.channels.map((c) => ({ value: c.id, label: `${c.icon?.trim() || "#"} ${c.name}` })),
  ];

  const valid =
    title.trim().length > 0 &&
    (kind !== "funnel" || steps.length >= 2) &&
    (kind !== "insight" || !!insight);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const prev = widget?.config ?? {};
    const config: WidgetConfig = { x: prev.x, y: prev.y, w, h };
    if (kind === "timeseries") {
      config.channel = channel || undefined;
      config.event = event || undefined;
      config.interval = (interval || undefined) as WidgetConfig["interval"];
    } else if (kind === "breakdown") {
      config.by = by;
      config.channel = channel || undefined;
      config.limit = limit;
    } else if (kind === "funnel") {
      config.steps = steps;
      config.window_hours = windowHours;
    } else if (kind === "insight") {
      config.insight = insight;
    }
    try {
      const saved = widget
        ? await dashboards.updateWidget(projectId, dashboardId, widget.id, { title: title.trim(), config })
        : await dashboards.addWidget(projectId, dashboardId, { kind, title: title.trim(), config });
      toast({ message: `Widget "${saved.title}" saved`, intent: "success", icon: "tick" });
      onSaved(saved);
      onClose();
    } catch (err) {
      toastError(err, "Couldn't save widget");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={widget ? "Edit widget" : "Add widget"}
      icon="dashboard"
      style={{ width: 460 }}
    >
      <form onSubmit={submit}>
        <DialogBody>
          <FormGroup label="Title" labelFor="rl-widget-title">
            <InputGroup
              id="rl-widget-title"
              autoFocus
              placeholder={WIDGET_KIND_LABELS[kind]}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fill
            />
          </FormGroup>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <FormGroup label="Widget type">
              <HTMLSelect
                fill
                value={kind}
                onChange={(e) => pickKind(e.target.value as WidgetKind)}
                options={Object.entries(WIDGET_KIND_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </FormGroup>
            <FormGroup label="Size">
              <div style={{ display: "flex", gap: 8 }}>
                <HTMLSelect fill value={w} onChange={(e) => setW(Number(e.target.value))} options={WIDTHS} />
                <HTMLSelect fill value={h} onChange={(e) => setH(Number(e.target.value))} options={HEIGHTS} />
              </div>
            </FormGroup>
          </div>

          {kind === "timeseries" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <FormGroup label="Channel">
                  <HTMLSelect fill value={channel} onChange={(e) => setChannel(e.target.value)} options={channelOptions} />
                </FormGroup>
                <FormGroup label="Event">
                  <HTMLSelect
                    fill
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    options={[{ value: "", label: "All events" }, ...eventOptions.map((n) => ({ value: n, label: n }))]}
                  />
                </FormGroup>
              </div>
              <FormGroup label="Interval" helperText="Auto buckets hourly for 24h, daily otherwise.">
                <HTMLSelect
                  fill
                  value={interval}
                  onChange={(e) => setInterval_(e.target.value)}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "hour", label: "Hourly" },
                    { value: "day", label: "Daily" },
                  ]}
                />
              </FormGroup>
            </>
          )}

          {kind === "breakdown" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
              <FormGroup label="Group by">
                <HTMLSelect
                  fill
                  value={by}
                  onChange={(e) => setBy(e.target.value as typeof by)}
                  options={[
                    { value: "event", label: "Events" },
                    { value: "channel", label: "Channels" },
                    { value: "user", label: "Users" },
                  ]}
                />
              </FormGroup>
              <FormGroup label="Channel">
                <HTMLSelect fill value={channel} onChange={(e) => setChannel(e.target.value)} options={channelOptions} />
              </FormGroup>
              <FormGroup label="Top N">
                <NumericInput
                  fill
                  min={1}
                  max={50}
                  value={limit}
                  onValueChange={(v) => setLimit(Number.isFinite(v) ? v : 10)}
                  buttonPosition="none"
                />
              </FormGroup>
            </div>
          )}

          {kind === "funnel" && (
            <>
              <FormGroup label="Steps" helperText="Pick 2–6 event names in order.">
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
              </FormGroup>
              <FormGroup label="Conversion window (hours)" inline>
                <NumericInput
                  min={1}
                  max={720}
                  value={windowHours}
                  onValueChange={(v) => setWindowHours(Number.isFinite(v) ? v : 168)}
                  style={{ width: 80 }}
                  buttonPosition="none"
                />
              </FormGroup>
            </>
          )}

          {kind === "insight" && (
            <FormGroup
              label="Insight"
              helperText={detail.insights.length === 0 ? "No insights yet — publish one from your backend first." : undefined}
            >
              <HTMLSelect
                fill
                value={insight}
                onChange={(e) => setInsight(e.target.value)}
                options={[
                  ...(insight ? [] : [{ value: "", label: "Pick an insight…" }]),
                  ...detail.insights.map((i) => ({ value: i.title, label: `${i.icon?.trim() || "📈"} ${i.title}` })),
                ]}
              />
            </FormGroup>
          )}
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button text="Cancel" onClick={onClose} />
              <Button
                type="submit"
                intent="primary"
                text={widget ? "Save widget" : "Add widget"}
                loading={busy}
                disabled={!valid}
                onClick={submit}
              />
            </>
          }
        />
      </form>
    </Dialog>
  );
}
