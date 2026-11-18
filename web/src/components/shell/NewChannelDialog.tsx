import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Dialog, DialogBody, DialogFooter, FormGroup, InputGroup } from "@blueprintjs/core";
import { projects, type Channel } from "@/lib/api";
import { toast, toastError } from "@/lib/toaster";

export function NewChannelDialog({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCreated?: (c: Channel) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📣");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await projects.createChannel(projectId, name.trim(), icon || "📣");
      toast({ message: `Channel "${c.name}" created`, intent: "success", icon: "tick" });
      setName("");
      onCreated?.(c);
      onClose();
      navigate({
        to: "/app/$projectId/channels/$channelId",
        params: { projectId, channelId: c.id },
      });
    } catch (err) {
      toastError(err, "Couldn't create channel");
      setBusy(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="New channel"
      icon="feed"
      style={{ width: 420 }}
      onOpened={() => document.getElementById("rl-new-channel-name")?.focus()}
    >
      <form onSubmit={submit}>
        <DialogBody>
          <FormGroup label="Channel name" labelFor="rl-new-channel-name">
            <InputGroup
              id="rl-new-channel-name"
              placeholder="payments"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fill
            />
          </FormGroup>
          <FormGroup label="Icon" labelFor="rl-new-channel-icon" helperText="An emoji, e.g. 💰">
            <InputGroup
              id="rl-new-channel-icon"
              placeholder="📣"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              style={{ maxWidth: 90 }}
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
                text="Create channel"
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
