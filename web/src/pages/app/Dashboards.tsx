import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Button,
  Card,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  Icon,
  InputGroup,
  NonIdealState,
} from "@blueprintjs/core";
import { dashboards } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";
import { PageHeader } from "@/components/app/PageHeader";
import { RelativeTime } from "@/components/app/RelativeTime";
import { errMsg } from "@/components/app/util";

export default function Dashboards() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const navigate = useNavigate();
  const req = useAsync(() => dashboards.list(projectId), [projectId]);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="rl-page rl-page-data">
      <PageHeader
        title="Dashboards"
        subtitle="Saved analytics widgets in one place"
        actions={
          <Button intent="primary" icon="plus" text="New dashboard" onClick={() => setCreateOpen(true)} />
        }
      />

      {req.error ? (
        <Card>
          <NonIdealState icon="error" title="Couldn't load dashboards" description={errMsg(req.error)} />
        </Card>
      ) : req.loading ? (
        <div className="rl-dash-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className={Classes.SKELETON} style={{ height: 96, borderRadius: 8 }} />
          ))}
        </div>
      ) : !req.data?.length ? (
        <Card>
          <NonIdealState
            icon="dashboard"
            title="No dashboards yet"
            description="Create a dashboard and pin timeseries, breakdowns, funnels and KPI tiles to it."
            action={
              <Button intent="primary" icon="plus" text="New dashboard" onClick={() => setCreateOpen(true)} />
            }
          />
        </Card>
      ) : (
        <div className="rl-dash-list">
          {req.data.map((d) => (
            <Card
              key={d.id}
              interactive
              onClick={() =>
                navigate({
                  to: "/app/$projectId/dashboards/$dashboardId",
                  params: { projectId, dashboardId: d.id },
                })
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                <Icon icon="dashboard" size={14} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              </div>
              <div className="rl-stat-sub" style={{ marginTop: 8 }}>
                {d.widgetCount} widget{d.widgetCount === 1 ? "" : "s"} · created <RelativeTime iso={d.createdAt} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewDashboardDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}

function NewDashboardDialog({
  isOpen,
  onClose,
  projectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const d = await dashboards.create(projectId, name.trim());
      toast({ message: `Dashboard "${d.name}" created`, intent: "success", icon: "tick" });
      setName("");
      onClose();
      navigate({
        to: "/app/$projectId/dashboards/$dashboardId",
        params: { projectId, dashboardId: d.id },
      });
    } catch (err) {
      toastError(err, "Couldn't create dashboard");
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="New dashboard"
      icon="dashboard"
      style={{ width: 420 }}
      onOpened={() => document.getElementById("rl-new-dashboard-name")?.focus()}
    >
      <form onSubmit={submit}>
        <DialogBody>
          <FormGroup label="Name" labelFor="rl-new-dashboard-name">
            <InputGroup
              id="rl-new-dashboard-name"
              placeholder="e.g. Product metrics"
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
                text="Create dashboard"
                loading={busy}
                disabled={!name.trim()}
                onClick={submit}
              />
            </>
          }
        />
      </form>
    </Dialog>
  );
}
