import { useEffect, useRef, useState } from "react";
import { Card, Tag } from "@blueprintjs/core";

type FakeEvent = { key: number; icon: string; event: string; desc: string; channel: string };

const POOL: Omit<FakeEvent, "key">[] = [
  { icon: "💰", event: "New Subscription", desc: "jane@acme.com · pro yearly", channel: "payments" },
  { icon: "🙋", event: "User signed up", desc: "marco@startup.io", channel: "auth" },
  { icon: "🚨", event: "Payment failed", desc: "card declined · user_8412", channel: "payments" },
  { icon: "🚀", event: "Deployed", desc: "v2.14.0 → production", channel: "ops" },
  { icon: "✨", event: "Trial started", desc: "team@globex.com", channel: "growth" },
  { icon: "💸", event: "MRR updated", desc: "$12,480 · +4.2%", channel: "insights" },
  { icon: "🧪", event: "Experiment viewed", desc: "onboarding-v2 · user_331", channel: "growth" },
  { icon: "🔥", event: "Usage spike", desc: "3.1× events in last hour", channel: "ops" },
  { icon: "👋", event: "Subscription canceled", desc: "bob@initech.com", channel: "payments" },
  { icon: "⭐", event: "NPS response", desc: "score: 10 · user_72", channel: "growth" },
];

const AGES = ["now", "1m", "2m", "4m", "8m", "14m", "22m"];

/** Animated mock of the live event feed for the landing page hero. */
export function LiveFeedMock() {
  const counter = useRef(4);
  const [items, setItems] = useState<FakeEvent[]>(() =>
    POOL.slice(0, 4).map((e, i) => ({ ...e, key: i })),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setItems((prev) => {
        const next = POOL[Math.floor(Math.random() * POOL.length)];
        return [{ ...next, key: counter.current++ }, ...prev].slice(0, 7);
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="rl-feed" elevation={3} aria-label="Example live event feed">
      <div className="rl-feed-head">
        <Tag minimal intent="success" icon="pulse">
          LIVE
        </Tag>
        <span className="rl-feed-title">acme-saas · all channels</span>
      </div>
      <ul className="rl-feed-list">
        {items.map((e, i) => (
          <li key={e.key} className="rl-feed-item">
            <span className="rl-feed-icon" aria-hidden>
              {e.icon}
            </span>
            <span className="rl-feed-body">
              <span className="rl-feed-event">{e.event}</span>
              <span className="rl-feed-desc">
                #{e.channel} · {e.desc}
              </span>
            </span>
            <span className="rl-feed-age">{AGES[Math.min(i, AGES.length - 1)]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
