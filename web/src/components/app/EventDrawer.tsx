import { Button, Classes, Drawer, Tag } from "@blueprintjs/core";
import { Link } from "@tanstack/react-router";
import type { RlEvent } from "@/lib/api";
import { Markdown } from "./Markdown";
import { absTime, copyText, eventToCurl } from "./util";

/** Right-side drawer with full event details, raw JSON and "copy as curl". */
export function EventDrawer({
  ev,
  projectId,
  projectName,
  onClose,
}: {
  ev: RlEvent | null;
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const tags = Object.entries(ev?.tags ?? {});
  return (
    <Drawer
      isOpen={ev != null}
      onClose={onClose}
      size={480}
      icon={<span style={{ fontSize: 20 }}>{ev?.icon?.trim() || "•"}</span>}
      title={ev?.event ?? ""}
    >
      {ev && (
        <>
          <div className={Classes.DRAWER_BODY}>
            <div className="rl-stack">
              <div className="rl-kv">
                <dt>Time</dt>
                <dd>{absTime(ev.timestamp)}</dd>
                <dt>Channel</dt>
                <dd style={{ fontFamily: "inherit" }}>
                  <Tag minimal># {ev.channel}</Tag>
                </dd>
                {ev.user_id && (
                  <>
                    <dt>User</dt>
                    <dd>
                      <Link to="/app/$projectId/users/$userId" params={{ projectId, userId: ev.user_id }} onClick={onClose}>
                        {ev.user_id}
                      </Link>
                    </dd>
                  </>
                )}
                <dt>Notify</dt>
                <dd>{ev.notify ? "yes" : "no"}</dd>
                <dt>Event id</dt>
                <dd>{ev.id}</dd>
              </div>

              {ev.description && (
                <div>
                  <div className="rl-stat-label" style={{ marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13.5 }}>
                    <Markdown text={ev.description} />
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div>
                  <div className="rl-stat-label" style={{ marginBottom: 6 }}>Tags</div>
                  <div className="rl-event-tags">
                    {tags.map(([k, v]) => (
                      <Tag key={k} minimal round>
                        {k}: {v}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="rl-stat-label" style={{ marginBottom: 6 }}>Raw JSON</div>
                <pre className="rl-drawer-json">{JSON.stringify(ev, null, 2)}</pre>
              </div>
            </div>
          </div>
          <div className={Classes.DRAWER_FOOTER}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button icon="duplicate" text="Copy JSON" onClick={() => copyText(JSON.stringify(ev, null, 2), "Event JSON copied")} />
              <Button icon="console" text="Copy as curl" onClick={() => copyText(eventToCurl(ev, projectName, location.origin), "curl command copied")} />
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
