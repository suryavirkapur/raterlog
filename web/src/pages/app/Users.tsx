import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button, Card, Classes, HTMLTable, InputGroup, NonIdealState } from "@blueprintjs/core";
import { users, type IdentifiedUser } from "@/lib/api";
import { useProject } from "@/lib/context";
import { useAsync } from "@/lib/hooks";
import { PageHeader } from "@/components/app/PageHeader";
import { RelativeTime } from "@/components/app/RelativeTime";
import { errMsg } from "@/components/app/util";

const MAX_PROP_COLS = 4;

function propValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

export default function Users() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { detail } = useProject();
  const res = useAsync(() => users.list(projectId), [projectId], { pollMs: 30_000 });
  const [q, setQ] = useState("");

  // Pick the most common property keys across users for the table columns.
  const propKeys = useMemo(() => {
    const freq = new Map<string, number>();
    for (const u of res.data ?? []) {
      for (const k of Object.keys(u.properties ?? {})) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PROP_COLS)
      .map(([k]) => k);
  }, [res.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = res.data ?? [];
    if (!needle) return list;
    return list.filter(
      (u: IdentifiedUser) =>
        u.userId.toLowerCase().includes(needle) ||
        JSON.stringify(u.properties ?? {}).toLowerCase().includes(needle),
    );
  }, [res.data, q]);

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader title="Users" subtitle={`${detail.company.name} — identified users`} />

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <InputGroup
          small
          leftIcon="search"
          placeholder="Search by id or property…"
          style={{ width: 260, maxWidth: "100%" }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card compact style={{ padding: 0 }}>
        {res.loading ? (
          <div style={{ padding: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={Classes.SKELETON} style={{ height: 30, marginBottom: 8, borderRadius: 6 }} />
            ))}
          </div>
        ) : res.error ? (
          <NonIdealState
            icon="error"
            title="Couldn't load users"
            description={errMsg(res.error)}
            action={<Button icon="refresh" text="Retry" onClick={() => res.reload()} />}
          />
        ) : filtered.length === 0 ? (
          <NonIdealState
            icon="people"
            title={q ? "No users match your search" : "No identified users yet"}
            description={
              q
                ? undefined
                : "Attach a user_id to events and POST /v1/identify to build user profiles and journeys."
            }
          />
        ) : (
          <div className="rl-table-wrap">
            <HTMLTable compact interactive style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>User id</th>
                  {propKeys.map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                  <th style={{ textAlign: "right" }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow key={u.id} u={u} projectId={projectId} propKeys={propKeys} />
                ))}
              </tbody>
            </HTMLTable>
          </div>
        )}
      </Card>
    </div>
  );
}

function UserRow({ u, projectId, propKeys }: { u: IdentifiedUser; projectId: string; propKeys: string[] }) {
  const navigate = useNavigate();
  return (
    <tr
      style={{ cursor: "pointer" }}
      onClick={() =>
        void navigate({ to: "/app/$projectId/users/$userId", params: { projectId, userId: u.userId } })
      }
    >
      <td>
        <span className="rl-event-user">{u.userId}</span>
      </td>
      {propKeys.map((k) => (
        <td key={k} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {propValue(u.properties?.[k])}
        </td>
      ))}
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <RelativeTime iso={u.updatedAt} />
      </td>
    </tr>
  );
}
