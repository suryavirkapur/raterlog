import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Callout,
  Card,
  InputGroup,
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ai, analytics, projects, type AiSummary, type Channel } from "@/lib/api";
import { useProject } from "@/lib/context";
import { useAsync } from "@/lib/hooks";
import { toast, toastError } from "@/lib/toaster";
import { EventFeed, type FeedFilters } from "@/components/app/EventFeed";
import { PageHeader } from "@/components/app/PageHeader";
import { Markdown } from "@/components/app/Markdown";
import { CHART } from "@/components/app/chartTheme";
import { fmtNum } from "@/components/app/util";

export default function ChannelPage() {
  const { projectId, channelId } = useParams({ strict: false }) as { projectId: string; channelId: string };
  const { detail, reload } = useProject();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>({});

  const channel = detail.channels.find((c) => c.id === channelId || c.name === channelId);

  const spark = useAsync(
    () =>
      channel
        ? analytics.timeseries(projectId, { range: "24h", interval: "hour", channel: channel.id })
        : Promise.resolve([]),
    [projectId, channel?.id],
    { pollMs: 30_000 },
  );
  const count24h = spark.data?.reduce((n, p) => n + p.count, 0);

  if (!channel) {
    return (
      <div style={{ padding: 24 }}>
        <NonIdealState
          icon="search"
          title="Channel not found"
          description="It may have been deleted."
          action={
            <Button
              text="Back to feed"
              onClick={() =>
                navigate({
                  to: "/app/$projectId",
                  params: { projectId },
                  search: { q: undefined, event: undefined, tag: undefined },
                })
              }
            />
          }
        />
      </div>
    );
  }

  const doDelete = async () => {
    setDeleting(true);
    try {
      await projects.deleteChannel(projectId, channel.id);
      await toast({ message: `Channel "${channel.name}" deleted`, intent: "success", icon: "tick" });
      await reload();
      void navigate({
        to: "/app/$projectId",
        params: { projectId },
        search: { q: undefined, event: undefined, tag: undefined },
      });
    } catch (e) {
      toastError(e, "Couldn't delete channel");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        icon={<span style={{ fontSize: 26 }}>{channel.icon?.trim() || "#"}</span>}
        title={channel.name}
        subtitle={
          count24h != null ? `${fmtNum(count24h)} events in the last 24h` : "Channel activity"
        }
        actions={
          <Button icon="trash" intent="danger" minimal text="Delete channel" onClick={() => setConfirmDelete(true)} />
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Card compact>
          <div className="rl-stat-label" style={{ marginBottom: 6 }}>Last 24 hours</div>
          {spark.loading ? (
            <div style={{ height: 44, display: "grid", placeItems: "center" }}>
              <Spinner size={18} />
            </div>
          ) : spark.error ? (
            <div className="rl-muted" style={{ fontSize: 12 }}>Chart unavailable</div>
          ) : (
            <div style={{ height: 44 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark.data ?? []} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={CHART.primary}
                    strokeWidth={1.5}
                    fill={CHART.primarySoft}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <AiCopilot channel={channel} />
      </div>

      <EventFeed
        projectId={projectId}
        filters={{ ...filters, channel: channel.id }}
        onFiltersChange={setFilters}
        fixedChannelId={channel.id}
        hideChannelFilter
        emptyState={
          <NonIdealState
            icon="satellite"
            title={`No events in #${channel.name} yet`}
            description="Events appear here as soon as they're ingested."
          />
        }
      />

      <Alert
        isOpen={confirmDelete}
        icon="trash"
        intent="danger"
        canEscapeKeyCancel
        canOutsideClickCancel
        cancelButtonText="Cancel"
        confirmButtonText={deleting ? "Deleting…" : "Delete channel"}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
        loading={deleting}
      >
        <p>
          Delete channel <b>{channel.name}</b>? Its events will remain, but new events sent to this channel will recreate
          it.
        </p>
      </Alert>
    </div>
  );
}

/** Collapsible AI copilot card: channel summary + free-form questions. */
function AiCopilot({ channel }: { channel: Channel }) {
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const runSummary = async () => {
    setSummarizing(true);
    try {
      setSummary(await ai.summarize(channel.id));
      setUnavailable(null);
    } catch (e) {
      setUnavailable(e instanceof Error ? e.message : "AI copilot is unavailable");
    } finally {
      setSummarizing(false);
    }
  };

  const runAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    try {
      const r = await ai.ask(channel.id, q);
      setAnswer(r.answer);
      setUnavailable(null);
    } catch (e) {
      setUnavailable(e instanceof Error ? e.message : "AI copilot is unavailable");
    } finally {
      setAsking(false);
    }
  };

  return (
    <Section
      compact
      collapsible
      collapseProps={{ defaultIsOpen: false }}
      icon="predictive-analysis"
      title="AI copilot"
      subtitle="Summaries and answers for this channel"
      rightElement={
        <Button small minimal icon="automatic-updates" text="Summarize" loading={summarizing} onClick={(e) => { e.stopPropagation(); void runSummary(); }} />
      }
    >
      <SectionCard style={{ paddingTop: 10 }}>
        {unavailable && (
          <Callout intent="warning" compact style={{ marginBottom: 10 }}>
            {unavailable}
          </Callout>
        )}
        {summary && (
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Markdown text={summary.summary} />
            {summary.anomalies.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {summary.anomalies.map((a, i) => (
                  <Tag key={i} intent="warning" minimal style={{ marginRight: 6 }}>
                    {a.event_name}: {a.reason}
                  </Tag>
                ))}
              </div>
            )}
            {summary.event_counts.length > 0 && (
              <div className="rl-muted" style={{ marginTop: 8, fontSize: 12 }}>
                {summary.event_counts.map((c) => `${c.name} ×${fmtNum(c.count)}`).join("  ·  ")}
              </div>
            )}
          </div>
        )}
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            void runAsk();
          }}
        >
          <InputGroup
            small
            fill
            leftIcon="chat"
            placeholder="Ask about this channel…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button small intent="primary" icon="send-message" text="Ask" type="submit" loading={asking} disabled={!question.trim()} />
        </form>
        {answer && (
          <Callout icon="predictive-analysis" compact style={{ marginTop: 10, fontSize: 13 }}>
            <Markdown text={answer} />
          </Callout>
        )}
      </SectionCard>
    </Section>
  );
}
