// Thin data/auth layouts (integrator-owned). Visual chrome lives in
// components/shell/AppShell.tsx.
import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "@tanstack/react-router";
import { NonIdealState, Spinner } from "@blueprintjs/core";
import { ApiError, auth, projects, type CompanyDetail, type User } from "@/lib/api";
import { ProjectContext, SessionContext } from "@/lib/context";
import AppShell from "@/components/shell/AppShell";

export function FullPageSpinner() {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
      <Spinner size={32} />
    </div>
  );
}

/** /app/* : requires a session, then renders the shell. */
export function AppLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    auth.me().then(setUser, () => setUser(null));
  }, []);
  if (user === undefined) return <FullPageSpinner />;
  if (user === null) return <Navigate to="/signin" search={{ email: "", invite: "" }} />;
  return (
    <SessionContext.Provider value={user}>
      <AppShell>
        <Outlet />
      </AppShell>
    </SessionContext.Provider>
  );
}

/** /app/$projectId/* : loads the project and provides it via useProject(). */
export function ProjectLayout() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const [detail, setDetail] = useState<CompanyDetail | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setDetail(await projects.get(projectId));
      try {
        localStorage.setItem("rl-last-project", projectId);
      } catch {}
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setDetail(null);
      else setErr(e instanceof Error ? e.message : "Failed to load project");
    }
  }, [projectId]);

  useEffect(() => {
    setDetail(undefined);
    reload();
  }, [reload]);

  if (err) return <NonIdealState icon="error" title="Couldn't load project" description={err} />;
  if (detail === undefined) return <FullPageSpinner />;
  if (detail === null)
    return <NonIdealState icon="search" title="Project not found" description="It may have been deleted, or you don't have access." />;
  return (
    <ProjectContext.Provider value={{ detail, reload }}>
      <Outlet />
    </ProjectContext.Provider>
  );
}
