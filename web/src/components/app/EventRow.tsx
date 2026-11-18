import { memo } from "react";
import { Icon, Tag, Tooltip } from "@blueprintjs/core";
import { Link } from "@tanstack/react-router";
import type { RlEvent } from "@/lib/api";
import { Markdown } from "./Markdown";
import { RelativeTime } from "./RelativeTime";

const MAX_TAGS = 3;

/**
 * One dense event row: emoji, name, channel tag and markdown description on a
 * single line, trailing tag chips, then user + time in fixed-width columns.
 * Click opens the detail drawer.
 */
export const EventRow = memo(function EventRow({
  ev,
  projectId,
  fresh,
  showChannel = true,
  onOpen,
  onTagClick,
  onChannelClick,
}: {
  ev: RlEvent;
  projectId: string;
  /** Flash-highlight animation for just-arrived events. */
  fresh?: boolean;
  showChannel?: boolean;
  onOpen?: (ev: RlEvent) => void;
  onTagClick?: (kv: string) => void;
  onChannelClick?: (channelId: string, channelName: string) => void;
}) {
  const tags = Object.entries(ev.tags ?? {});
  const shown = tags.slice(0, MAX_TAGS);
  const extra = tags.length - shown.length;
  return (
    <div
      className={`rl-event${fresh ? " rl-event-new" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(ev)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(ev);
        }
      }}
    >
      <div className="rl-event-icon">{ev.icon?.trim() || "•"}</div>
      <div className="rl-event-main">
        <span className="rl-event-name">{ev.event}</span>
        {showChannel && ev.channel && (
          <Tag
            minimal
            className="rl-event-chan"
            interactive={!!onChannelClick}
            onClick={
              onChannelClick
                ? (e) => {
                    e.stopPropagation();
                    onChannelClick(ev.channel_id, ev.channel);
                  }
                : undefined
            }
          >
            {ev.channel}
          </Tag>
        )}
        {ev.notify && (
          <Tooltip content="Push notification enabled" placement="top" hoverOpenDelay={200}>
            <Icon icon="notifications" size={11} className="rl-muted" />
          </Tooltip>
        )}
        {ev.description && (
          <span className="rl-event-desc">
            <Markdown text={ev.description} />
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="rl-event-tags">
          {shown.map(([k, v]) => (
            <Tag
              key={k}
              minimal
              round
              interactive={!!onTagClick}
              onClick={
                onTagClick
                  ? (e) => {
                      e.stopPropagation();
                      onTagClick(`${k}:${v}`);
                    }
                  : undefined
              }
            >
              {k}: {v}
            </Tag>
          ))}
          {extra > 0 && (
            <Tag minimal round>
              +{extra}
            </Tag>
          )}
        </div>
      )}
      <div className="rl-event-meta">
        {ev.user_id ? (
          <Link
            className="rl-event-user"
            to="/app/$projectId/users/$userId"
            params={{ projectId, userId: ev.user_id }}
            onClick={(e) => e.stopPropagation()}
          >
            {ev.user_id}
          </Link>
        ) : (
          <span className="rl-event-user" />
        )}
        <RelativeTime iso={ev.timestamp} className="rl-event-time" />
      </div>
    </div>
  );
});
