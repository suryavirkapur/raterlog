import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button, Card, Classes, NonIdealState } from "@blueprintjs/core";
import { users, type RlEvent } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { PageHeader } from "@/components/app/PageHeader";
import { StatTile } from "@/components/app/StatTile";
import { EventRow } from "@/components/app/EventRow";
import { EventDrawer } from "@/components/app/EventDrawer";
import { RelativeTime } from "@/components/app/RelativeTime";
import { useProject } from "@/lib/context";
import { dayLabel, errMsg, fmtNum } from "@/components/app/util";

export default function UserJourney() {
  const { projectId, userId } = useParams({ strict: false }) as { projectId: string; userId: string };
  const { detail } = useProject();
  const navigate = useNavigate();
  const res = useAsync(() => users.get(projectId, userId), [projectId, userId], { pollMs: 30_000 });
  const [selected, setSelected] = useState<RlEvent | null>(null);

  const profile = res.data?.user ?? null;
  const events = res.data?.events ?? [];

  const stats = useMemo(() => {
    const times = events.map((e) => new Date(e.timestamp).getTime()).filter((t) => !Number.isNaN(t));
    return {
      total: events.length,
      first: times.length ? new Date(Math.min(...times)).toISOString() : profile?.updatedAt,
      last: times.length ? new Date(Math.max(...times)).toISOString() : profile?.updatedAt,
    };
  }, [events, profile]);

  const groups = useMemo(() => {
    const out: { label: string; items: RlEvent[] }[] = [];
    for (const e of events) {
      const label = dayLabel(e.timestamp);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [events]);

  const props = Object.entries(profile?.properties ?? {});

  return (
    <div className="rl-page rl-page-data">
      <PageHeader
        icon={<Button small minimal icon="arrow-left" onClick={() => history.back()} />}
        title={<span className="rl-mono" style={{ fontSize: 17 }}>{userId}</span>}
        subtitle={profile ? "Identified user" : "Events for this user id (never identified)"}
      />

      {res.loading ? (
        <div className={Classes.SKELETON} style={{ height: 220, borderRadius: 6 }} />
      ) : res.error ? (
        <NonIdealState
          icon="error"
          title="Couldn't load user"
          description={errMsg(res.error)}
          action={<Button icon="refresh" text="Retry" onClick={() => res.reload()} />}
        />
      ) : (
        <>
          <div className="rl-journey-top">
            <Card compact>
              <div className="rl-stat-label" style={{ marginBottom: 8 }}>Profile</div>
              {props.length === 0 ? (
                <div className="rl-muted" style={{ fontSize: 13 }}>
                  No properties — send them with POST /v1/identify.
                </div>
              ) : (
                <dl className="rl-kv">
                  {props.map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt>{k}</dt>
                      <dd>{typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {profile && (
                <div className="rl-stat-sub" style={{ marginTop: 10 }}>
                  profile updated <RelativeTime iso={profile.updatedAt} />
                </div>
              )}
            </Card>
            <div className="rl-stats">
              <StatTile icon="feed" label="Total events" value={stats.total} />
              <StatTile
                icon="time"
                label="First seen"
                value={stats.first ? <RelativeTime iso={stats.first} /> : "—"}
              />
              <StatTile icon="updated" label="Last seen" value={stats.last ? <RelativeTime iso={stats.last} /> : "—"} />
            </div>
          </div>

          <div className="rl-stat-label" style={{ margin: "4px 0 8px" }}>
            Journey ({fmtNum(events.length)} events)
          </div>
          {events.length === 0 ? (
            <Card compact>
              <NonIdealState icon="path" title="No events for this user" />
            </Card>
          ) : (
            <Card compact style={{ padding: 4 }}>
              <div className="rl-timeline">
                {groups.map((g) => (
                  <div key={g.label}>
                    <div className="rl-day-header" style={{ paddingLeft: 28 }}>
                      {g.label}
                    </div>
                    {g.items.map((ev) => (
                      <EventRow
                        key={ev.id}
                        ev={ev}
                        projectId={projectId}
                        onOpen={setSelected}
                        onTagClick={(kv) =>
                          void navigate({
                            to: "/app/$projectId",
                            params: { projectId },
                            search: { q: undefined, event: undefined, tag: kv },
                          })
                        }
                        onChannelClick={(chId) =>
                          void navigate({
                            to: "/app/$projectId/channels/$channelId",
                            params: { projectId, channelId: chId },
                          })
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <EventDrawer ev={selected} projectId={projectId} projectName={detail.company.name} onClose={() => setSelected(null)} />
    </div>
  );
}
