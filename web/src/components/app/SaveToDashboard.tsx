import { useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  InputGroup,
} from "@blueprintjs/core";
import { Link } from "@tanstack/react-router";
import { dashboards, type WidgetConfig, type WidgetKind } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";

const NEW = "__new__";

/**
 * "Save to dashboard" button + dialog: stores the current analytics query as a
 * widget (same params the analytics endpoints take) on a picked dashboard.
 */
export function SaveToDashboard({
  projectId,
  kind,
  defaultTitle,
  config,
}: {
  projectId: string;
  kind: WidgetKind;
  defaultTitle: string;
  config: WidgetConfig;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pick, setPick] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const listReq = useAsync(() => dashboards.list(projectId), [projectId]);

  function openDialog() {
    setTitle(defaultTitle);
    setPick(listReq.data?.[0]?.id ?? NEW);
    setNewName("");
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || (pick === NEW && !newName.trim())) return;
    setBusy(true);
    try {
      const dashboardId =
        pick === NEW ? (await dashboards.create(projectId, newName.trim())).id : pick;
      const w = await dashboards.addWidget(projectId, dashboardId, {
        kind,
        title: title.trim(),
        config,
      });
      void listReq.reload();
      toast({ message: `Widget "${w.title}" added to dashboard`, intent: "success", icon: "tick" });
      setOpen(false);
    } catch (err) {
      toastError(err, "Couldn't save widget");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button small icon="dashboard" text="Save to dashboard" onClick={openDialog} />
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Save to dashboard"
        icon="dashboard"
        style={{ width: 420 }}
      >
        <form onSubmit={submit}>
          <DialogBody>
            <FormGroup label="Widget title" labelFor="rl-save-widget-title">
              <InputGroup
                id="rl-save-widget-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fill
              />
            </FormGroup>
            <FormGroup label="Dashboard">
              <HTMLSelect
                fill
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                options={[
                  ...(listReq.data ?? []).map((d) => ({ value: d.id, label: d.name })),
                  { value: NEW, label: "New dashboard…" },
                ]}
              />
            </FormGroup>
            {pick === NEW && (
              <FormGroup label="New dashboard name" labelFor="rl-new-dash-name">
                <InputGroup
                  id="rl-new-dash-name"
                  placeholder="e.g. Product metrics"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  fill
                />
              </FormGroup>
            )}
            {!listReq.loading && listReq.data?.length === 0 && (
              <div className="rl-muted" style={{ fontSize: 12 }}>
                No dashboards yet — one will be created for you. Manage them under{" "}
                <Link to="/app/$projectId/dashboards" params={{ projectId } as never}>
                  Dashboards
                </Link>
                .
              </div>
            )}
          </DialogBody>
          <DialogFooter
            actions={
              <>
                <Button text="Cancel" onClick={() => setOpen(false)} />
                <Button
                  type="submit"
                  intent="primary"
                  text="Save widget"
                  loading={busy}
                  disabled={!title.trim() || (pick === NEW && !newName.trim())}
                  onClick={submit}
                />
              </>
            }
          />
        </form>
      </Dialog>
    </>
  );
}
