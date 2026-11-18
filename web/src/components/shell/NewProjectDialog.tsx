import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Dialog, DialogBody, DialogFooter, FormGroup, InputGroup } from "@blueprintjs/core";
import { projects, type Company } from "@/lib/api";
import { toast, toastError } from "@/lib/toaster";

export function NewProjectDialog({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (c: Company) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await projects.create(name.trim());
      toast({ message: `Project "${c.name}" created`, intent: "success", icon: "tick" });
      setName("");
      onCreated?.(c);
      onClose();
      navigate({ to: "/app/$projectId/setup", params: { projectId: c.id } });
    } catch (err) {
      toastError(err, "Couldn't create project");
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="New project"
      icon="plus"
      style={{ width: 420 }}
      onOpened={() => document.getElementById("rl-new-project-name")?.focus()}
    >
      <form onSubmit={submit}>
        <DialogBody>
          <FormGroup
            label="Project name"
            labelFor="rl-new-project-name"
            helperText="This is also the `project` field your code sends to /v1/log."
          >
            <InputGroup
              id="rl-new-project-name"
              placeholder="my-saas"
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
                text="Create project"
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
