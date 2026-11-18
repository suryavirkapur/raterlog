import { createContext, useContext } from "react";
import type { CompanyDetail, User } from "./api";

/** The signed-in user. Available anywhere under /app. */
export const SessionContext = createContext<User | null>(null);
export function useSession(): User {
  const u = useContext(SessionContext);
  if (!u) throw new Error("useSession must be used under /app");
  return u;
}

/** The current project (companyId) with channels, tokens, members, invites, insights. Under /app/$projectId. */
export type ProjectCtx = { detail: CompanyDetail; reload: () => Promise<void> };
export const ProjectContext = createContext<ProjectCtx | null>(null);
export function useProject(): ProjectCtx {
  const p = useContext(ProjectContext);
  if (!p) throw new Error("useProject must be used under /app/$projectId");
  return p;
}
