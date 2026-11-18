import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Card,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
  Menu,
  MenuItem,
  NonIdealState,
  Popover,
} from "@blueprintjs/core";
import {
  dashboards,
  type DashboardWidget,
  type Range,
  type WidgetLayout,
} from "@/lib/api";
import { useAsync, useLocalState } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";
import { PageHeader } from "@/components/app/PageHeader";
import { RangeSelect } from "@/components/app/RangeSelect";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetEditor } from "@/components/app/WidgetEditor";
import { errMsg } from "@/components/app/util";

const widgetW = (w: DashboardWidget) => w.config.w ?? 6;
const widgetH = (w: DashboardWidget) => w.config.h ?? 3;

export default function DashboardView() {
  const { projectId, dashboardId } = useParams({ strict: false }) as {
    projectId: string;
    dashboardId: string;
  };
  const navigate = useNavigate();
  const req = useAsync(() => dashboards.get(projectId, dashboardId), [projectId, dashboardId]);
  const [range, setRange] = useLocalState<Range>(`rl-dash-range-${dashboardId}`, "7d");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reading order (y, x, title); widgets without a y land at the bottom.
  const laid = useMemo(() => {
    const ws = [...(req.data?.widgets ?? [])].sort(
      (a, b) =>
        (a.config.y ?? 1e9) - (b.config.y ?? 1e9) ||
        (a.config.x ?? 0) - (b.config.x ?? 0) ||
        a.title.localeCompare(b.title),
    );
    let bottom = 0;
    return ws.map((widget) => {
      const y = widget.config.y ?? bottom;
      const x = widget.config.x ?? 0;
      bottom = Math.max(bottom, y + widgetH(widget));
      return { widget, x, y };
    });
  }, [req.data]);

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= laid.length) return;
    const layout: WidgetLayout[] = laid.map((e) => ({
      id: e.widget.id,
      x: e.x,
      y: e.y,
      w: widgetW(e.widget),
      h: widgetH(e.widget),
    }));
    // Swap the two slots so they trade places in the grid.
    const { x: ax, y: ay } = layout[i]!;
    layout[i] = { ...layout[i]!, x: layout[j]!.x, y: layout[j]!.y };
    layout[j] = { ...layout[j]!, x: ax, y: ay };
    req.setData(
      (d) =>
        d && {
          ...d,
          widgets: d.widgets.map((w) => {
            const p = layout.find((l) => l.id === w.id)!;
            return { ...w, config: { ...w.config, x: p.x, y: p.y, w: p.w, h: p.h } };
          }),
        },
    );
    try {
      await dashboards.saveLayout(projectId, dashboardId, layout);
    } catch (e) {
      toastError(e, "Couldn't save layout");
      void req.reload();
    }
  }

  async function removeWidget(w: DashboardWidget) {
    try {
      await dashboards.removeWidget(projectId, dashboardId, w.id);
      req.setData((d) => d && { ...d, widgets: d.widgets.filter((x) => x.id !== w.id) });
      toast({ message: `Widget "${w.title}" deleted`, intent: "success", icon: "tick" });
    } catch (e) {
      toastError(e, "Couldn't delete widget");
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await dashboards.remove(projectId, dashboardId);
      toast({ message: "Dashboard deleted", intent: "success", icon: "tick" });
      navigate({ to: "/app/$projectId/dashboards", params: { projectId } });
    } catch (e) {
      toastError(e, "Couldn't delete dashboard");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (req.error)
    return (
      <div className="rl-page rl-page-data">
        <NonIdealState
          icon="error"
          title="Couldn't load dashboard"
          description={errMsg(req.error)}
          action={
            <Link to="/app/$projectId/dashboards" params={{ projectId } as never}>
              <Button icon="arrow-left" text="Back to dashboards" />
            </Link>
          }
        />
      </div>
    );
  if (!req.data)
    return (
      <div className="rl-page rl-page-data">
        <div className={Classes.SKELETON} style={{ height: 280, borderRadius: 8 }} />
      </div>
    );

  const dash = req.data.dashboard;

  return (
    <div className="rl-page rl-page-data">
      <PageHeader
        title={dash.name}
        subtitle={
          <>
            <Link to="/app/$projectId/dashboards" params={{ projectId } as never} className="rl-muted">
              Dashboards
            </Link>
            {` · ${laid.length} widget${laid.length === 1 ? "" : "s"} · last ${range}`}
          </>
        }
        actions={
          <>
            <RangeSelect value={range} onChange={setRange} />
            <Button
              small
              intent="primary"
              icon="plus"
              text="Add widget"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            />
            <Popover
              minimal
              placement="bottom-end"
              content={
                <Menu>
                  <MenuItem icon="edit" text="Rename…" onClick={() => setRenameOpen(true)} />
                  <MenuItem icon="trash" text="Delete" intent="danger" onClick={() => setConfirmDelete(true)} />
                </Menu>
              }
            >
              <Button minimal icon="more" aria-label="Dashboard options" />
            </Popover>
          </>
        }
      />

      {laid.length === 0 ? (
        <Card>
          <NonIdealState
            icon="dashboard"
            title="No widgets yet"
            description="Add a widget here, or save one from the Analytics page with “Save to dashboard”."
            action={
              <Button
                intent="primary"
                icon="plus"
                text="Add widget"
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
              />
            }
          />
        </Card>
      ) : (
        <div className="rl-dash-grid">
          {laid.map((e, i) => (
            <WidgetCard
              key={e.widget.id}
              projectId={projectId}
              widget={e.widget}
              range={range}
              x={e.x}
              y={e.y}
              first={i === 0}
              last={i === laid.length - 1}
              onEdit={() => {
                setEditing(e.widget);
                setEditorOpen(true);
              }}
              onMove={(dir) => void move(i, dir)}
              onDelete={() => void removeWidget(e.widget)}
            />
          ))}
        </div>
      )}

      <WidgetEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        projectId={projectId}
        dashboardId={dashboardId}
        widget={editing}
        onSaved={() => void req.reload()}
      />

      <RenameDialog
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        current={dash.name}
        onSubmit={async (name) => {
          const d = await dashboards.rename(projectId, dashboardId, name);
          req.setData((prev) => prev && { ...prev, dashboard: d });
          toast({ message: "Dashboard renamed", intent: "success", icon: "tick" });
        }}
      />

      <Alert
        isOpen={confirmDelete}
        icon="trash"
        intent="danger"
        canEscapeKeyCancel
        canOutsideClickCancel
        cancelButtonText="Cancel"
        confirmButtonText={deleting ? "Deleting…" : "Delete dashboard"}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
        loading={deleting}
      >
        <p>
          Delete dashboard <b>{dash.name}</b> and its {laid.length} widget
          {laid.length === 1 ? "" : "s"}? This can't be undone.
        </p>
      </Alert>
    </div>
  );
}

function RenameDialog({
  isOpen,
  onClose,
  current,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  current: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      toastError(err, "Couldn't rename dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Rename dashboard"
      icon="edit"
      style={{ width: 400 }}
      onOpened={() => {
        setName(current);
        document.getElementById("rl-rename-dashboard")?.focus();
      }}
    >
      <form onSubmit={submit}>
        <DialogBody>
          <FormGroup label="Name" labelFor="rl-rename-dashboard">
            <InputGroup
              id="rl-rename-dashboard"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fill
            />
          </FormGroup>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button text="Cancel" onClick={onClose} />
              <Button
                type="submit"
                intent="primary"
                text="Rename"
                loading={busy}
                disabled={!name.trim() || name.trim() === current}
                onClick={submit}
              />
            </>
          }
        />
      </form>
    </Dialog>
  );
}
