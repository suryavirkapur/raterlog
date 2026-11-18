import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Button,
  ButtonGroup,
  Card,
  Classes,
  HTMLSelect,
  InputGroup,
  NonIdealState,
  Tooltip,
} from "@blueprintjs/core";
import { analytics, events as eventsApi, type EventFilter, type RlEvent } from "@/lib/api";
import { useProject } from "@/lib/context";
import { toastError } from "@/lib/toaster";
import { EventDrawer } from "./EventDrawer";
import { EventRow } from "./EventRow";
import { dayLabel, errMsg } from "./util";
import "./app.css";

export interface FeedFilters {
  q?: string;
  event?: string;
  channel?: string; // channel id
  tag?: string; // "key:value"
  user_id?: string;
}

const PAGE = 50;
const POLL_MS = 3000;
const MAX_KEEP = 1500;

function fireNotification(ev: RlEvent) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(`${ev.icon?.trim() ? ev.icon.trim() + " " : ""}${ev.event}`, {
      body: ev.description?.trim() || `#${ev.channel}`,
      tag: `raterlog-${ev.id}`,
    });
  } catch {}
}

/**
 * Reusable live event feed: polls `events.list` with `since`, paginates with
 * `before`, groups rows by day and renders a filter bar. Filters are controlled
 * by the parent so pages can sync them to the URL or local state.
 */
export function EventFeed({
  projectId,
  filters,
  onFiltersChange,
  fixedChannelId,
  hideChannelFilter = false,
  emptyState,
  onChannelClick,
}: {
  projectId: string;
  filters: FeedFilters;
  onFiltersChange: (f: FeedFilters) => void;
  /** Lock the feed to one channel (channel page). */
  fixedChannelId?: string;
  hideChannelFilter?: boolean;
  /** Shown instead of the default empty state. */
  emptyState?: ReactNode;
  onChannelClick?: (channelId: string, channelName: string) => void;
}) {
  const { detail } = useProject();
  const channels = detail.channels;

  const [events, setEvents] = useState<RlEvent[]>([]);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState<RlEvent | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  // Text inputs (debounced before propagating to `filters`).
  const [qInput, setQInput] = useState(filters.q ?? "");
  const [eventInput, setEventInput] = useState(filters.event ?? "");
  const [tagInput, setTagInput] = useState(filters.tag ?? "");
  const [userInput, setUserInput] = useState(filters.user_id ?? "");

  const eventsRef = useRef<RlEvent[]>(events);
  eventsRef.current = events;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onChangeRef = useRef(onFiltersChange);
  onChangeRef.current = onFiltersChange;

  const filterKey = [projectId, fixedChannelId, filters.q, filters.event, filters.channel, filters.tag, filters.user_id].join(
    "\u0001",
  );

  const apiFilters = useCallback(
    (extra?: Partial<EventFilter>): EventFilter => {
      const f = filtersRef.current;
      return {
        q: f.q,
        event: f.event,
        tag: f.tag,
        user_id: f.user_id,
        channel: fixedChannelId ?? f.channel,
        limit: PAGE,
        ...extra,
      };
    },
    [fixedChannelId],
  );

  // ── Event names for the <datalist> suggestions ──
  const [eventNames, setEventNames] = useState<string[]>([]);
  useEffect(() => {
    let dead = false;
    analytics
      .breakdown(projectId, { range: "90d", by: "event", limit: 200 })
      .then((rows) => {
        if (!dead) setEventNames(rows.map((r) => r.key));
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [projectId]);
  const nameOptions = useMemo(
    () => [...new Set([...eventNames, ...events.map((e) => e.event)])].sort(),
    [eventNames, events],
  );
  const datalistId = useId();

  // ── Sync inputs when filters change from outside (tag click, URL nav) ──
  useEffect(() => setQInput(filters.q ?? ""), [filters.q]);
  useEffect(() => setEventInput(filters.event ?? ""), [filters.event]);
  useEffect(() => setTagInput(filters.tag ?? ""), [filters.tag]);
  useEffect(() => setUserInput(filters.user_id ?? ""), [filters.user_id]);

  // ── Debounced propagate input → parent filters ──
  useEffect(() => {
    const t = setTimeout(() => {
      const f = filtersRef.current;
      const norm = (v: string) => v.trim() || undefined;
      const next: FeedFilters = {
        ...f,
        q: norm(qInput),
        event: norm(eventInput),
        tag: norm(tagInput),
        user_id: norm(userInput),
      };
      if (next.q === f.q && next.event === f.event && next.tag === f.tag && next.user_id === f.user_id) return;
      onChangeRef.current(next);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput, eventInput, tagInput, userInput]);

  // ── Initial load / reload on filter change ──
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let dead = false;
    setLoading(true);
    setError(null);
    setEvents([]);
    setHasMore(false);
    eventsApi
      .list(projectId, apiFilters())
      .then((list) => {
        if (dead) return;
        setEvents(list);
        setHasMore(list.length >= PAGE);
      })
      .catch((e) => {
        if (!dead) setError(errMsg(e, "Couldn't load events"));
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, reloadTick]);

  // ── Live polling ──
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const newest = eventsRef.current[0]?.id;
      eventsApi
        .list(projectId, apiFilters({ since: newest }))
        .then((list) => {
          if (!list?.length) return;
          const known = new Set(eventsRef.current.map((e) => e.id));
          const add = list.filter((e) => !known.has(e.id));
          if (!add.length) return;
          setEvents((prev) => {
            const prevIds = new Set(prev.map((e) => e.id));
            return [...add.filter((a) => !prevIds.has(a.id)), ...prev].slice(0, MAX_KEEP);
          });
          setFreshIds((prev) => {
            const next = new Set(prev);
            for (const e of add) next.add(e.id);
            return next;
          });
          for (const e of add) if (e.notify) fireNotification(e);
          setTimeout(() => {
            setFreshIds((prev) => {
              const next = new Set(prev);
              for (const e of add) next.delete(e.id);
              return next;
            });
          }, 8000);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [live, projectId, filterKey, apiFilters]);

  // ── Load older pages ──
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadMore = useCallback(async () => {
    const last = eventsRef.current[eventsRef.current.length - 1];
    if (!last || loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    try {
      const list = await eventsApi.list(projectId, apiFilters({ before: last.id }));
      setEvents((prev) => {
        const known = new Set(prev.map((e) => e.id));
        return [...prev, ...list.filter((e) => !known.has(e.id))];
      });
      setHasMore(list.length >= PAGE);
    } catch (e) {
      toastError(e, "Couldn't load older events");
    } finally {
      setLoadingMore(false);
    }
  }, [projectId, apiFilters, loadingMore]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (ents) => {
        if (ents.some((e) => e.isIntersecting)) void loadMoreRef.current();
      },
      { rootMargin: "240px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

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

  const hasActiveFilters = !!(
    filters.q ||
    filters.event ||
    (!fixedChannelId && filters.channel) ||
    filters.tag ||
    filters.user_id
  );

  return (
    <div>
      <div className="rl-feed-filters">
        <InputGroup
          className="rl-feed-search"
          leftIcon="search"
          placeholder="Search events…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <InputGroup
          leftIcon="pulse"
          placeholder="Event name"
          style={{ width: 160 }}
          value={eventInput}
          onChange={(e) => setEventInput(e.target.value)}
          list={datalistId}
        />
        <datalist id={datalistId}>
          {nameOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {!hideChannelFilter && (
          <HTMLSelect
            value={filters.channel ?? ""}
            onChange={(e) => onFiltersChange({ ...filters, channel: e.target.value || undefined })}
            options={[
              { value: "", label: "All channels" },
              ...channels.map((c) => ({ value: c.id, label: `${c.icon?.trim() || "#"} ${c.name}` })),
            ]}
          />
        )}
        <InputGroup
          leftIcon="tag"
          placeholder="tag key:value"
          style={{ width: 140 }}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />
        <InputGroup
          leftIcon="person"
          placeholder="User id"
          style={{ width: 130 }}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
        {hasActiveFilters && (
          <Button minimal icon="filter-remove" text="Clear" onClick={() => onFiltersChange({})} />
        )}
        <div className="rl-feed-controls">
          {notifPerm === "default" && (
            <Tooltip content="Enable browser notifications for events with notify: true" placement="bottom">
              <Button
                minimal
                icon="notifications"
                onClick={() => {
                  Notification.requestPermission().then(setNotifPerm, () => {});
                }}
              />
            </Tooltip>
          )}
          <ButtonGroup>
            <Button active={live} intent={live ? "success" : "none"} onClick={() => setLive((v) => !v)}>
              <span className="rl-live">
                <span className={`rl-live-dot${live ? "" : " paused"}`} />
                {live ? "Live" : "Paused"}
              </span>
            </Button>
            <Tooltip content="Reload" placement="bottom">
              <Button icon="refresh" onClick={() => setReloadTick((t) => t + 1)} loading={loading && events.length === 0} />
            </Tooltip>
          </ButtonGroup>
        </div>
      </div>

      <Card compact style={{ padding: 4, overflowX: "hidden" }}>
        {loading && events.length === 0 ? (
          <div style={{ padding: 8 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={Classes.SKELETON} style={{ height: 34, marginBottom: 8, borderRadius: 6 }} />
            ))}
          </div>
        ) : error && events.length === 0 ? (
          <NonIdealState
            icon="error"
            title="Couldn't load events"
            description={error}
            action={<Button icon="refresh" text="Retry" onClick={() => setReloadTick((t) => t + 1)} />}
          />
        ) : events.length === 0 ? (
          !hasActiveFilters && emptyState ? (
            emptyState
          ) : (
            <NonIdealState icon="search" title={hasActiveFilters ? "No events match these filters" : "No events yet"} />
          )
        ) : (
          groups.map((g) => (
            <div key={g.label} className="rl-day-group">
              <div className="rl-day-header">{g.label}</div>
              {g.items.map((ev) => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  projectId={projectId}
                  fresh={freshIds.has(ev.id)}
                  showChannel={!fixedChannelId}
                  onOpen={setSelected}
                  onTagClick={(kv) => onFiltersChange({ ...filters, tag: kv })}
                  onChannelClick={onChannelClick}
                />
              ))}
            </div>
          ))
        )}
        <div ref={sentinelRef} className="rl-feed-sentinel" />
        {hasMore && events.length > 0 && (
          <div className="rl-feed-more">
            <Button minimal loading={loadingMore} text="Load older events" onClick={() => void loadMore()} />
          </div>
        )}
        {!hasMore && events.length > 0 && !loading && (
          <div className="rl-feed-more rl-muted" style={{ fontSize: 12 }}>
            You're all caught up
          </div>
        )}
      </Card>

      <EventDrawer ev={selected} projectId={projectId} projectName={detail.company.name} onClose={() => setSelected(null)} />
    </div>
  );
}
