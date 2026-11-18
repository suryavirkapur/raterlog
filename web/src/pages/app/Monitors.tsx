import { useState, type FormEvent } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Callout,
  Card,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  NonIdealState,
  NumericInput,
  Spinner,
  Switch,
  Tag,
  TagInput,
} from "@blueprintjs/core";
import {
  monitors,
  type Monitor,
  type MonitorCondition,
  type MonitorInput,
} from "@/lib/api";
import { useProject } from "@/lib/context";
import { useAsync } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";
import { PageHeader } from "@/components/app/PageHeader";
import { RelativeTime } from "@/components/app/RelativeTime";
import { errMsg } from "@/components/app/util";

function ruleText(m: Monitor): string {
  return m.condition === "absent"
    ? `no events in ${m.windowMinutes}m`
    : `${m.condition === "count_above" ? ">" : "<"} ${m.threshold} events in ${m.windowMinutes}m`;
}

function filterText(m: Monitor): string {
  const parts = [
    m.channel ? `channel ${m.channel}` : "",
    m.event ? `event "${m.event}"` : "",
    m.tag ? `tag ${m.tag}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "all events";
}

function StatusTag({ m }: { m: Monitor }) {
  if (!m.enabled) return <Tag minimal>disabled</Tag>;
  return m.state === "alerting" ? (
    <Tag intent="danger" icon="error">
      alerting
    </Tag>
  ) : (
    <Tag intent="success" icon="tick">
      ok
    </Tag>
  );
}

/* ── Create / edit dialog ────────────────────── */

function MonitorDialog({
  isOpen,
  onClose,
  projectId,
  monitor,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  monitor: Monitor | null; // null = create
  onSaved: () => void;
}) {
  const { detail } = useProject();
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [channel, setChannel] = useState("");
  const [event, setEvent] = useState("");
  const [tag, setTag] = useState("");
  const [condition, setCondition] = useState<MonitorCondition>("count_above");
  const [threshold, setThreshold] = useState(10);
  const [windowMin, setWindowMin] = useState(60);
  const [cooldownMin, setCooldownMin] = useState(60);
  const [emails, setEmails] = useState<string[]>([]);
  const [webhooks, setWebhooks] = useState<string[]>([]);
  const [notifyResolved, setNotifyResolved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(monitor?.name ?? "");
    setEnabled(monitor?.enabled ?? true);
    setChannel(monitor?.channel ?? "");
    setEvent(monitor?.event ?? "");
    setTag(monitor?.tag ?? "");
    setCondition(monitor?.condition ?? "count_above");
    setThreshold(monitor?.threshold ?? 10);
    setWindowMin(monitor?.windowMinutes ?? 60);
    setCooldownMin(monitor?.cooldownMinutes ?? 60);
    setEmails(monitor?.notifyEmails ?? []);
    setWebhooks(monitor?.webhookUrls ?? []);
    setNotifyResolved(monitor?.notifyResolved ?? true);
    setError(null);
    setBusy(false);
  };

  const body: MonitorInput = {
    name: name.trim(),
    enabled,
    channel,
    event: event.trim(),
    tag: tag.trim(),
    condition,
    threshold: condition === "absent" ? 0 : threshold,
    window_minutes: windowMin,
    cooldown_minutes: cooldownMin,
    notify_emails: emails,
    webhook_urls: webhooks,
    notify_resolved: notifyResolved,
  };
  const valid = name.trim() !== "" && windowMin >= 1 && cooldownMin >= 0 && (condition === "absent" || threshold >= 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (monitor) {
        await monitors.update(projectId, monitor.id, body);
        void toast({ message: `Monitor "${body.name}" updated`, intent: "success", icon: "tick" });
      } else {
        await monitors.create(projectId, body);
        void toast({ message: `Monitor "${body.name}" created`, intent: "success", icon: "tick" });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errMsg(err, "Couldn't save monitor"));
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      onOpened={reset}
      title={monitor ? `Edit monitor` : "New monitor"}
      icon="notifications"
      style={{ width: 520 }}
    >
      <form onSubmit={submit}>
        <div className={Classes.DIALOG_BODY}>
          <FormGroup label="Name" labelFor="rl-monitor-name">
            <InputGroup
              id="rl-monitor-name"
              placeholder="Payment failures spike"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fill
            />
          </FormGroup>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <FormGroup label="Channel" labelFor="rl-monitor-channel" style={{ marginBottom: 10 }}>
              <HTMLSelect id="rl-monitor-channel" value={channel} onChange={(e) => setChannel(e.target.value)} fill>
                <option value="">All channels</option>
                {detail.channels.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </HTMLSelect>
            </FormGroup>
            <FormGroup label="Event name" labelFor="rl-monitor-event" style={{ marginBottom: 10 }}>
              <InputGroup
                id="rl-monitor-event"
                placeholder="any"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Tag" labelFor="rl-monitor-tag" helperText="key:value" style={{ marginBottom: 10 }}>
              <InputGroup
                id="rl-monitor-tag"
                placeholder="plan:pro"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </FormGroup>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormGroup label="Alert when" labelFor="rl-monitor-condition" style={{ marginBottom: 10 }}>
              <HTMLSelect
                id="rl-monitor-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as MonitorCondition)}
                fill
              >
                <option value="count_above">event count is above</option>
                <option value="count_below">event count is below</option>
                <option value="absent">no events arrive</option>
              </HTMLSelect>
            </FormGroup>
            {condition !== "absent" ? (
              <FormGroup label="Threshold" labelFor="rl-monitor-threshold" style={{ marginBottom: 10 }}>
                <NumericInput
                  id="rl-monitor-threshold"
                  min={0}
                  value={threshold}
                  onValueChange={(v) => setThreshold(Number.isNaN(v) ? 0 : v)}
                  fill
                />
              </FormGroup>
            ) : (
              <div />
            )}
            <FormGroup label="Window (minutes)" labelFor="rl-monitor-window" style={{ marginBottom: 10 }}>
              <NumericInput
                id="rl-monitor-window"
                min={1}
                max={10080}
                value={windowMin}
                onValueChange={(v) => setWindowMin(Number.isNaN(v) ? 60 : v)}
                fill
              />
            </FormGroup>
            <FormGroup
              label="Cooldown (minutes)"
              labelFor="rl-monitor-cooldown"
              helperText="min time between alerts"
              style={{ marginBottom: 10 }}
            >
              <NumericInput
                id="rl-monitor-cooldown"
                min={0}
                max={10080}
                value={cooldownMin}
                onValueChange={(v) => setCooldownMin(Number.isNaN(v) ? 0 : v)}
                fill
              />
            </FormGroup>
          </div>

          <FormGroup
            label="Notify emails"
            labelFor="rl-monitor-emails"
            helperText="press enter to add — uses the server's SMTP settings"
          >
            <TagInput
              inputProps={{ id: "rl-monitor-emails" }}
              placeholder="oncall@company.com"
              values={emails}
              onChange={(v) => setEmails(v as string[])}
              addOnBlur
              fill
            />
          </FormGroup>
          <FormGroup
            label="Webhook URLs"
            labelFor="rl-monitor-webhooks"
            helperText="Slack and Discord webhooks get their native format; other URLs get a JSON POST"
          >
            <TagInput
              inputProps={{ id: "rl-monitor-webhooks" }}
              placeholder="https://hooks.slack.com/services/…"
              values={webhooks}
              onChange={(v) => setWebhooks(v as string[])}
              addOnBlur
              fill
            />
          </FormGroup>

          <div style={{ display: "flex", gap: 20 }}>
            <Switch label="Enabled" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />
            <Switch
              label="Notify when resolved"
              checked={notifyResolved}
              onChange={(e) => setNotifyResolved(e.currentTarget.checked)}
            />
          </div>

          {error && (
            <Callout intent="danger" compact style={{ marginTop: 12 }}>
              {error}
            </Callout>
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text="Cancel" onClick={onClose} />
            <Button
              type="submit"
              intent="primary"
              text={monitor ? "Save monitor" : "Create monitor"}
              loading={busy}
              disabled={!valid}
              onClick={submit}
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────── */

export default function Monitors() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const res = useAsync(() => monitors.list(projectId), [projectId], { pollMs: 30_000 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Monitor | null>(null);
  const [toDelete, setToDelete] = useState<Monitor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const list = res.data;

  const runTest = async (m: Monitor) => {
    setTesting(m.id);
    try {
      const r = await monitors.test(projectId, m.id);
      if (r.ok) {
        void toast({ message: `Test sent to ${r.sent} target${r.sent === 1 ? "" : "s"}`, intent: "success", icon: "send-message" });
      } else {
        void toast({
          message: `${r.sent}/${r.targets} delivered — ${r.errors[0] ?? "some targets failed"}`,
          intent: "warning",
          icon: "warning-sign",
        });
      }
    } catch (e) {
      toastError(e, "Couldn't send test");
    } finally {
      setTesting(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await monitors.delete(projectId, toDelete.id);
      void toast({ message: `Monitor "${toDelete.name}" deleted`, intent: "success", icon: "tick" });
      setToDelete(null);
      void res.reload();
    } catch (e) {
      toastError(e, "Couldn't delete monitor");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rl-page rl-page-narrow">
      <PageHeader
        title="Monitors"
        subtitle="Get alerted when event volume crosses a threshold — or stops entirely"
        actions={
          <Button
            intent="primary"
            icon="plus"
            text="New monitor"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />
        }
      />

      {res.loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
          <Spinner size={28} />
        </div>
      ) : res.error ? (
        <Callout intent="danger">Couldn't load monitors: {res.error.message}</Callout>
      ) : !list || list.length === 0 ? (
        <Card>
          <NonIdealState
            icon="notifications"
            title="No monitors yet"
            description="Create one to get an email or webhook when events spike, drop below a floor, or stop arriving."
            action={
              <Button
                intent="primary"
                icon="plus"
                text="New monitor"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              />
            }
          />
        </Card>
      ) : (
        <Card compact style={{ marginTop: 12 }}>
          <div className="rl-table-wrap">
            <HTMLTable compact interactive style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Rule</th>
                  <th>Notify</th>
                  <th>Last checked</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <StatusTag m={m} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div className="rl-muted" style={{ fontSize: 12 }}>
                        {filterText(m)}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{ruleText(m)}</td>
                    <td className="rl-muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {m.notifyEmails.length + m.webhookUrls.length === 0
                        ? "—"
                        : [
                            m.notifyEmails.length ? `${m.notifyEmails.length} email` : "",
                            m.webhookUrls.length ? `${m.webhookUrls.length} webhook` : "",
                          ]
                            .filter(Boolean)
                            .join(" + ")}
                    </td>
                    <td className="rl-muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {m.lastCheckedAt ? <RelativeTime iso={m.lastCheckedAt} /> : "never"}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Button
                        small
                        minimal
                        icon="send-message"
                        title="Send test notification"
                        loading={testing === m.id}
                        disabled={m.notifyEmails.length + m.webhookUrls.length === 0}
                        onClick={() => void runTest(m)}
                      />
                      <Button
                        small
                        minimal
                        icon="edit"
                        title="Edit"
                        onClick={() => {
                          setEditing(m);
                          setDialogOpen(true);
                        }}
                      />
                      <Button small minimal intent="danger" icon="trash" title="Delete" onClick={() => setToDelete(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </div>
        </Card>
      )}

      <MonitorDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={projectId}
        monitor={editing}
        onSaved={() => void res.reload()}
      />

      <Alert
        isOpen={toDelete != null}
        icon="trash"
        intent="danger"
        canEscapeKeyCancel
        canOutsideClickCancel
        cancelButtonText="Cancel"
        confirmButtonText="Delete monitor"
        loading={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      >
        <p>
          Delete monitor <b>{toDelete?.name}</b>? Its alert history and configuration will be removed.
        </p>
      </Alert>
    </div>
  );
}
