import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  Callout,
  FormGroup,
  InputGroup,
  NonIdealState,
  Spinner,
} from "@blueprintjs/core";
import { projects } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { toastError } from "@/lib/toaster";

export default function AppHome() {
  const navigate = useNavigate();
  const { data: list, loading, error, reload } = useAsync(() => projects.list(), []);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div style={{ height: "60vh", display: "grid", placeItems: "center" }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
        <NonIdealState
          icon="error"
          title="Couldn't load your projects"
          description={error.message}
          action={<Button text="Try again" onClick={reload} />}
        />
      </div>
    );
  }

  if (list && list.length > 0) {
    const last = (() => {
      try {
        return localStorage.getItem("rl-last-project");
      } catch {
        return null;
      }
    })();
    const target = list.find((p) => p.id === last) ?? list[0];
    return <Navigate to="/app/$projectId" params={{ projectId: target.id }} search={{ q: undefined, event: undefined, tag: undefined }} />;
  }

  async function createFirst(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await projects.create(name.trim());
      navigate({ to: "/app/$projectId/setup", params: { projectId: c.id } });
    } catch (err) {
      toastError(err, "Couldn't create project");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "8vh auto", padding: 24 }}>
      <Card elevation={1} style={{ padding: 28 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Welcome to Raterlog</h1>
        <p style={{ opacity: 0.75, fontSize: 14, margin: "0 0 20px" }}>
          A project is where your events live — usually one per app. Create your first one to get an
          API token and start logging.
        </p>
        <form onSubmit={createFirst}>
          <FormGroup label="Project name" labelFor="rl-first-project" helperText="e.g. my-saas, api, marketing-site">
            <InputGroup
              id="rl-first-project"
              large
              autoFocus
              placeholder="my-saas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fill
            />
          </FormGroup>
          <Button
            type="submit"
            large
            fill
            intent="primary"
            text="Create project"
            icon="rocket"
            loading={busy}
            disabled={!name.trim()}
            style={{ marginTop: 8 }}
          />
        </form>
      </Card>
      <Callout icon="info-sign" style={{ marginTop: 16 }}>
        You'll create an API token and send your first event on the next screen — about two
        minutes total.
      </Callout>
    </div>
  );
}
