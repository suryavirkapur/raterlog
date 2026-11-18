import { useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Button, NonIdealState } from "@blueprintjs/core";
import { EventFeed, type FeedFilters } from "@/components/app/EventFeed";
import { PageHeader } from "@/components/app/PageHeader";
import { useProject } from "@/lib/context";

export default function Feed() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const search = useSearch({ strict: false }) as { q?: string; event?: string; tag?: string };
  const navigate = useNavigate();
  const { detail } = useProject();
  // channel + user filters stay local (route only declares q/event/tag)
  const [local, setLocal] = useState<{ channel?: string; user_id?: string }>({});

  const filters: FeedFilters = {
    q: search.q,
    event: search.event,
    tag: search.tag,
    channel: local.channel,
    user_id: local.user_id,
  };

  const setFilters = (f: FeedFilters) => {
    setLocal({ channel: f.channel, user_id: f.user_id });
    void navigate({
      to: "/app/$projectId",
      params: { projectId },
      replace: true,
      search: { q: f.q, event: f.event, tag: f.tag },
    });
  };

  return (
    <div className="rl-page rl-page-data">
      <PageHeader
        title="Live feed"
        subtitle={`${detail.company.name} — every event, as it happens`}
      />
      <EventFeed
        projectId={projectId}
        filters={filters}
        onFiltersChange={setFilters}
        onChannelClick={(chId) =>
          void navigate({ to: "/app/$projectId/channels/$channelId", params: { projectId, channelId: chId } })
        }
        emptyState={
          <NonIdealState
            icon="satellite"
            title="No events yet"
            description="Send your first event with a single HTTP call — the feed lights up in real time."
            action={
              <Link to="/app/$projectId/setup" params={{ projectId }}>
                <Button intent="primary" icon="rocket" text="Go to setup" />
              </Link>
            }
          />
        }
      />
    </div>
  );
}
