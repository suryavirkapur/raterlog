import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@blueprintjs/core";
import { PLANS, INGEST_DOCS } from "@/lib/plans";
import { applyTheme, getTheme, type ThemeMode } from "@/lib/theme";
import "./landing.css";

const AUTH = { email: "", invite: "" };
const BASE = INGEST_DOCS.base;
const HOST = BASE.replace(/^https?:\/\//, "");

/* ───────────────────────── data ───────────────────────── */

type Ev = {
  icon: string;
  event: string;
  desc: string;
  channel: string;
  user?: string;
  tags?: Record<string, string>;
  notify?: boolean;
};

const EVENTS: Ev[] = [
  { icon: "💰", event: "New Subscription", desc: "jane@acme.com", channel: "payments", user: "user_1042", tags: { plan: "pro", cycle: "yearly" }, notify: true },
  { icon: "🙋", event: "User signed up", desc: "marco@startup.io", channel: "auth", user: "user_1043", tags: { source: "google" } },
  { icon: "🚨", event: "Payment failed", desc: "card declined", channel: "payments", user: "user_8412", tags: { plan: "growth", reason: "insufficient_funds" }, notify: true },
  { icon: "🚀", event: "Deployed", desc: "v2.14.0 → production", channel: "ops", tags: { env: "prod", sha: "9f3c1e2" } },
  { icon: "🤖", event: "Agent finished task", desc: "migrated 3 tables", channel: "agents", tags: { agent: "claude-code" } },
  { icon: "✨", event: "Trial started", desc: "team@globex.com", channel: "growth", user: "user_1044", tags: { plan: "starter" } },
  { icon: "🔥", event: "Usage spike", desc: "3.1× events in last hour", channel: "ops", tags: { service: "api" }, notify: true },
  { icon: "📨", event: "Invite accepted", desc: "sam@globex.com joined", channel: "growth", user: "user_1045", tags: { seats: "4" } },
  { icon: "👋", event: "Subscription canceled", desc: "bob@initech.com", channel: "payments", user: "user_0977", tags: { plan: "starter", reason: "too_expensive" } },
];

const CHANNELS = [
  ["payments", "1,284"],
  ["auth", "3,921"],
  ["growth", "872"],
  ["ops", "419"],
  ["agents", "156"],
] as const;

const AGES = ["now", "12s", "48s", "2m", "3m", "5m", "8m", "11m", "14m"];

const SOURCES = ["curl", "Node.js", "Python", "Go", "Rust", "Ruby", "PHP", "Stripe webhooks", "GitHub Actions", "Cron jobs", "MCP agents"];

const fmt = (n: number) => n.toLocaleString("en-US");

/* ───────────────────────── hooks ───────────────────────── */

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useTick(ms: number, on = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || reducedMotion()) return;
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms, on]);
  return n;
}

/** 0 → 1 as the element scrolls from entering the bottom to the middle of the viewport. */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(reducedMotion() ? 1 : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setP(Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.55 + r.height * 0.5))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return [ref, p] as const;
}

/* ───────────────────────── small pieces ───────────────────────── */

function Arrow() {
  return (
    <span className="ax-arrow" aria-hidden>
      →
    </span>
  );
}

function Learn({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="ax-learn">
      {children} <Arrow />
    </Link>
  );
}

function Tags({ tags }: { tags?: Record<string, string> }) {
  if (!tags) return null;
  return (
    <span className="ax-tags">
      {Object.entries(tags).map(([k, v]) => (
        <span key={k}>
          {k}:<b>{v}</b>
        </span>
      ))}
    </span>
  );
}

/* ───────────────────────── hero app window ───────────────────────── */

type Tab = "feed" | "analytics" | "funnels" | "agent";
const TABS: { id: Tab; label: string; icon: React.ComponentProps<typeof Icon>["icon"] }[] = [
  { id: "feed", label: "Feed", icon: "feed" },
  { id: "analytics", label: "Analytics", icon: "timeline-bar-chart" },
  { id: "funnels", label: "Funnels", icon: "filter" },
  { id: "agent", label: "Agent", icon: "console" },
];

function FeedPane() {
  const tick = useTick(2200);
  const rows = Array.from({ length: 9 }, (_, i) => EVENTS[(tick * 7 + 63 - i) % EVENTS.length]);
  const [sel, setSel] = useState(0);
  const ev = rows[sel] ?? rows[0];
  return (
    <div className="ax-pane ax-pane-feed">
      <div className="ax-toolbar">
        <div className="ax-search">
          <Icon icon="search" size={12} />
          <code>
            channel:<b>*</b> notify:<b>any</b>
          </code>
        </div>
        <span className="ax-pill">
          <Icon icon="time" size={11} /> Last 30 mins
        </span>
        <span className="ax-pill ax-pill-live">
          <i /> Live
        </span>
      </div>
      <div className="ax-feed-split">
        <ul className="ax-rows">
          {rows.map((e, i) => (
            <li
              key={`${tick}-${i}`}
              className={`${i === 0 ? "is-new " : ""}${i === sel ? "is-sel" : ""}`}
              onMouseEnter={() => setSel(i)}
            >
              <span className="ax-ev-icon">{e.icon}</span>
              <span className="ax-ev-main">
                <b>{e.event}</b>
                <small>
                  #{e.channel} · {e.desc}
                </small>
              </span>
              <Tags tags={e.tags} />
              {e.notify && <Icon icon="notifications" size={11} className="ax-bell" />}
              <span className="ax-age">{AGES[i]}</span>
            </li>
          ))}
        </ul>
        <aside className="ax-inspect">
          <div className="ax-inspect-h">Event</div>
          <dl>
            {[
              ["event", ev.event],
              ["channel", `#${ev.channel}`],
              ["description", ev.desc],
              ["user_id", ev.user ?? "—"],
              ...Object.entries(ev.tags ?? {}).map(([k, v]) => [`tags.${k}`, v]),
              ["notify", String(!!ev.notify)],
              ["icon", ev.icon],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

const HIST = Array.from({ length: 48 }, (_, i) => {
  const base = 30 + 18 * Math.sin(i / 5) + i * 0.7;
  const spike = i === 37 ? 46 : i === 38 ? 28 : 0;
  return Math.round(base + ((i * 37) % 13) + spike);
});

function AnalyticsPane() {
  const max = Math.max(...HIST);
  const rows = [
    ["User signed up", 3921],
    ["New Subscription", 1284],
    ["Invite accepted", 872],
    ["Deployed", 419],
    ["Payment failed", 96],
  ] as const;
  return (
    <div className="ax-pane">
      <div className="ax-toolbar">
        <div className="ax-search">
          <Icon icon="search" size={12} />
          <code>
            count() by <b>event</b> · interval <b>30m</b>
          </code>
        </div>
        <span className="ax-pill">
          <Icon icon="time" size={11} /> Last 24 hours
        </span>
      </div>
      <div className="ax-stats">
        {[
          ["Events", "48,213", "+18%"],
          ["Unique users", "6,904", "+9%"],
          ["Today", "2,117", "+4%"],
          ["Notified", "38", "−2"],
        ].map(([k, v, d]) => (
          <div key={k}>
            <small>{k}</small>
            <b>{v}</b>
            <em>{d}</em>
          </div>
        ))}
      </div>
      <div className="ax-hist" aria-hidden>
        {HIST.map((v, i) => (
          <i key={i} style={{ height: `${(v / max) * 100}%` }} className={i === 37 ? "is-peak" : ""} />
        ))}
      </div>
      <table className="ax-table">
        <thead>
          <tr>
            <th>event</th>
            <th>count</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{fmt(v)}</td>
              <td>
                <span className="ax-bar" style={{ width: `${(v / rows[0][1]) * 100}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FunnelPane() {
  const steps = [
    ["User signed up", 6904, 100],
    ["Created project", 4902, 71],
    ["Sent first event", 3728, 54],
    ["Invited teammate", 2209, 32],
    ["New Subscription", 1588, 23],
  ] as const;
  return (
    <div className="ax-pane">
      <div className="ax-toolbar">
        <div className="ax-search">
          <Icon icon="search" size={12} />
          <code>
            funnel within <b>7d</b> by <b>user_id</b>
          </code>
        </div>
        <span className="ax-pill">
          <Icon icon="time" size={11} /> Last 30 days
        </span>
      </div>
      <div className="ax-funnel">
        {steps.map(([label, n, pct], i) => (
          <div key={label} className="ax-funnel-step">
            <div className="ax-funnel-col">
              <i style={{ height: `${pct}%` }} />
            </div>
            <b>{pct}%</b>
            <span>{label}</span>
            <small>
              {fmt(n)} users{i > 0 && ` · −${steps[i - 1][2] - pct}pt`}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

const AGENT_LINES: [string, string][] = [
  ["q", "Why did failed payments jump this morning?"],
  ["tool", "raterlog.event_timeseries(event: \"Payment failed\", range: \"24h\")"],
  ["tool", "raterlog.top_breakdown(by: \"tag\", key: \"reason\", range: \"24h\")"],
  ["a", "Failed payments went from ~4/hour to 31 between 08:10 and 08:40 UTC."],
  ["a", "87% carry reason=insufficient_funds on the growth plan, right after renewals ran."],
  ["tool", "raterlog.log_event(channel: \"ops\", event: \"Dunning email sent\", notify: true)"],
  ["a", "Logged it to #ops and notified the team."],
];

function AgentPane({ active }: { active: boolean }) {
  const tick = useTick(900, active);
  const shown = reducedMotion() ? AGENT_LINES.length : Math.min(AGENT_LINES.length, tick + 1);
  return (
    <div className="ax-pane ax-pane-agent">
      <div className="ax-term-head">
        <span>◔ claude-code</span>
        <span className="ax-dim">raterlog-mcp connected · 13 tools</span>
      </div>
      <div className="ax-term">
        {AGENT_LINES.slice(0, shown).map(([k, t], i) => (
          <p key={i} className={`ax-t-${k}`}>
            {k === "q" ? "> " : k === "tool" ? "⏺ " : "  "}
            {t}
          </p>
        ))}
        {shown < AGENT_LINES.length && <p className="ax-t-wait">✻ Thinking…</p>}
        <p className="ax-t-prompt">
          &gt; <span className="ax-caret" />
        </p>
      </div>
    </div>
  );
}

function AppWindow() {
  const [tab, setTab] = useState<Tab>("feed");
  return (
    <div className="ax-app" role="group" aria-label="Interactive preview of the Raterlog app">
      <div className="ax-app-top">
        <span className="ax-app-logo">
          <img src="/icon.png" alt="" width={16} height={16} />
        </span>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "is-on" : ""}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
          >
            <Icon icon={t.icon} size={12} /> {t.label}
          </button>
        ))}
        <span className="ax-app-proj">acme-saas</span>
      </div>
      <div className="ax-app-body">
        <nav className="ax-side" aria-label="Channels (preview)">
          <div className="ax-side-h">Channels</div>
          <a className="is-on">
            <span>#</span>all-channels
          </a>
          {CHANNELS.map(([c, n]) => (
            <a key={c}>
              <span>#</span>
              {c}
              <em>{n}</em>
            </a>
          ))}
          <div className="ax-side-h">Insights</div>
          <div className="ax-kpi">
            <small>MRR</small>
            <b>$12,480</b>
          </div>
          <div className="ax-kpi">
            <small>Signups today</small>
            <b>41</b>
          </div>
        </nav>
        <div className="ax-main">
          {tab === "feed" && <FeedPane />}
          {tab === "analytics" && <AnalyticsPane />}
          {tab === "funnels" && <FunnelPane />}
          {tab === "agent" && <AgentPane active />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── try-it ───────────────────────── */

const LANGS = ["curl", "JavaScript", "Python", "Go"] as const;
type Lang = (typeof LANGS)[number];

function snippet(lang: Lang) {
  switch (lang) {
    case "curl":
      return `curl ${BASE}/v1/log \\
  -H "Authorization: Bearer $RATERLOG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project": "acme-saas",
    "channel": "payments",
    "event": "New Subscription",
    "icon": "💰",
    "notify": true,
    "tags": { "plan": "pro" },
    "user_id": "user_1042"
  }'`;
    case "JavaScript":
      return `await fetch("${BASE}/v1/log", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.RATERLOG_TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    project: "acme-saas",
    channel: "payments",
    event: "New Subscription",
    icon: "💰",
    notify: true,
    tags: { plan: "pro" },
    user_id: "user_1042",
  }),
});`;
    case "Python":
      return `import os, requests

requests.post(
    "${BASE}/v1/log",
    headers={"Authorization": f"Bearer {os.environ['RATERLOG_TOKEN']}"},
    json={
        "project": "acme-saas",
        "channel": "payments",
        "event": "New Subscription",
        "icon": "💰",
        "notify": True,
        "tags": {"plan": "pro"},
        "user_id": "user_1042",
    },
    timeout=2,
)`;
    case "Go":
      return `body := strings.NewReader(\`{
  "project": "acme-saas",
  "channel": "payments",
  "event": "New Subscription",
  "icon": "💰",
  "notify": true,
  "tags": {"plan": "pro"},
  "user_id": "user_1042"
}\`)
req, _ := http.NewRequest("POST", "${BASE}/v1/log", body)
req.Header.Set("Authorization", "Bearer "+os.Getenv("RATERLOG_TOKEN"))
req.Header.Set("Content-Type", "application/json")
http.DefaultClient.Do(req)`;
  }
}

function TryIt() {
  const [lang, setLang] = useState<Lang>("curl");
  const [sent, setSent] = useState<{ id: number; at: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const send = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      const at = new Date().toISOString().slice(11, 19);
      setSent((s) => [{ id: Date.now(), at }, ...s].slice(0, 3));
      setBusy(false);
    }, 380);
  };
  const last = sent[0];

  return (
    <div className="ax-try">
      <div className="ax-try-code">
        <div className="ax-tabs">
          {LANGS.map((l) => (
            <button key={l} type="button" className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>
              {l}
            </button>
          ))}
          <button type="button" className="ax-send" onClick={send} disabled={busy}>
            <Icon icon={busy ? "refresh" : "play"} size={11} className={busy ? "ax-spin" : ""} /> Send
          </button>
        </div>
        <pre>{snippet(lang)}</pre>
        <div className={`ax-resp${last ? " is-on" : ""}`}>
          {last ? (
            <>
              <span className="ax-ok">200 OK</span>
              <code>
                {`{"id":"${(last.id * 65536).toString().slice(0, 19)}","channel":"payments","event":"New Subscription"}`}
              </code>
              <span className="ax-dim">simulated · {last.at}</span>
            </>
          ) : (
            <span className="ax-dim">Press Send to simulate the request. No account needed.</span>
          )}
        </div>
      </div>
      <div className="ax-try-out" aria-live="polite">
        {sent.length === 0 && <div className="ax-try-empty">Your event lands here.</div>}
        {sent.map((s, i) => (
          <div key={s.id} className={`ax-notif${i === 0 ? " is-new" : ""}`}>
            <span className="ax-ev-icon">💰</span>
            <span className="ax-ev-main">
              <b>New Subscription</b>
              <small>#payments · plan:pro · user_1042</small>
            </span>
            <span className="ax-age">{i === 0 ? "now" : s.at}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── fragments for feature rows ───────────────────────── */

function PushFragment() {
  return (
    <div className="ax-frag ax-frag-push">
      <div className="ax-phone">
        <div className="ax-phone-time">09:41</div>
        {[EVENTS[2], EVENTS[0], EVENTS[6]].map((e, i) => (
          <div key={e.event} className="ax-push" style={{ opacity: 1 - i * 0.22, transform: `scale(${1 - i * 0.03})` }}>
            <span className="ax-ev-icon">{e.icon}</span>
            <span className="ax-ev-main">
              <b>{e.event}</b>
              <small>
                #{e.channel} · {e.desc}
              </small>
            </span>
            <span className="ax-age">{["now", "4m", "18m"][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyFragment() {
  const steps: [string, string, string][] = [
    ["🙋", "User signed up", "Mon 09:12"],
    ["📦", "Created project", "Mon 09:14"],
    ["📡", "Sent first event", "Mon 09:31"],
    ["📨", "Invited teammate", "Tue 11:02"],
    ["💰", "New Subscription", "Thu 16:45"],
  ];
  return (
    <div className="ax-frag">
      <div className="ax-card">
        <div className="ax-card-h">
          <span>
            user_1042 · <span className="ax-dim">jane@acme.com</span>
          </span>
          <span className="ax-dim">plan: pro · 5 events</span>
        </div>
        <ol className="ax-journey">
          {steps.map(([i, e, t]) => (
            <li key={e}>
              <span className="ax-ev-icon">{i}</span>
              <b>{e}</b>
              <span className="ax-age">{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ───────────────────────── pricing calculator ───────────────────────── */

const MIN_E = 1000;
const MAX_E = 1_000_000;
const toEvents = (v: number) => {
  const e = MIN_E * Math.pow(MAX_E / MIN_E, v / 100);
  const mag = Math.pow(10, Math.floor(Math.log10(e)) - 1);
  return Math.round(e / mag) * mag;
};

function Pricing() {
  const [v, setV] = useState(48);
  const [yearly, setYearly] = useState(false);
  const events = toEvents(v);
  const plan = useMemo(() => PLANS.find((p) => p.events_limit >= events) ?? PLANS[PLANS.length - 1], [events]);
  const price = yearly ? plan.price_year / 12 : plan.price_month;
  const used = Math.min(100, (events / plan.events_limit) * 100);

  return (
    <div className="ax-calc">
      <div className="ax-calc-top">
        <div>
          <small>Events per month</small>
          <b>{fmt(events)}</b>
        </div>
        <div className="ax-calc-price">
          <small>
            {plan.name} plan{yearly ? " · billed yearly" : ""}
          </small>
          <b>
            ${price % 1 ? price.toFixed(2) : price}
            <span>/mo</span>
          </b>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        aria-label="Events per month"
        className="ax-range"
        style={{ "--v": `${v}%` } as React.CSSProperties}
      />
      <div className="ax-range-scale">
        <span>1K</span>
        <span>10K</span>
        <span>100K</span>
        <span>1M</span>
      </div>
      <div className="ax-calc-foot">
        <label className="ax-switch">
          <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
          <i /> Yearly billing (2 months free)
        </label>
        <span className="ax-dim">
          Uses {used.toFixed(0)}% of the {fmt(plan.events_limit)} included events
        </span>
      </div>
      <div className="ax-plan-rows">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`ax-plan-row${p.id === plan.id ? " is-on" : ""}`}
            onClick={() => {
              const target = Math.min(p.events_limit, MAX_E) * 0.6;
              setV(Math.round((Math.log(target / MIN_E) / Math.log(MAX_E / MIN_E)) * 100));
            }}
          >
            <span className="ax-plan-name">{p.name}</span>
            <span className="ax-plan-meta">
              {fmt(p.events_limit)} events · {p.seats_limit < 0 ? "unlimited seats" : `${p.seats_limit} seats`} ·{" "}
              {p.retention_days >= 365 ? `${p.retention_days / 365}y` : `${p.retention_days}d`} history
            </span>
            <span className="ax-plan-bar">
              <i style={{ width: `${(Math.log10(p.events_limit) - 3) * 33.4}%` }} />
            </span>
            <span className="ax-plan-price">{p.price_month ? `$${yearly ? (p.price_year / 12).toFixed(0) : p.price_month}` : "Free"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── statement ───────────────────────── */

const STATEMENT =
  "Your product is talking all day: signups, payments, failures, deploys. Raterlog makes sure someone is listening, and that the right person hears it first.";

function Statement() {
  const [ref, p] = useScrollProgress<HTMLParagraphElement>();
  const words = STATEMENT.split(" ");
  const lit = Math.round(p * words.length * 1.05);
  return (
    <p ref={ref} className="ax-statement">
      {words.map((w, i) => (
        <span key={i} className={i < lit ? "is-lit" : ""}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/* ───────────────────────── nav ───────────────────────── */

function Nav({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`ax-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="ax-wrap ax-nav-in">
        <Link to="/" className="ax-logo" aria-label="Raterlog home">
          <img src="/icon.png" alt="" width={20} height={20} />
          Raterlog
        </Link>
        <nav className="ax-nav-links" aria-label="Site">
          <a href="#product">Product</a>
          <a href="#agents">Agents</a>
          <a href="#pricing">Pricing</a>
          <Link to="/docs">Docs</Link>
        </nav>
        <div className="ax-nav-right">
          <button
            type="button"
            className="ax-icon-btn"
            onClick={onToggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <Icon icon={theme === "dark" ? "flash" : "moon"} size={13} />
          </button>
          <Link to="/signin" search={AUTH} className="ax-nav-signin">
            Sign in
          </Link>
          <Link to="/signup" search={AUTH} className="ax-btn ax-btn-accent ax-btn-sm">
            Start free <Arrow />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function Landing() {
  const [theme, setTheme] = useState<ThemeMode>(getTheme);

  return (
    <div className={`ax${theme === "light" ? " is-light" : ""}`}>
      <Nav
        theme={theme}
        onToggle={() => {
          const next = theme === "dark" ? "light" : "dark";
          applyTheme(next);
          setTheme(next);
        }}
      />

      {/* Hero */}
      <section className="ax-hero">
        <div className="ax-streaks" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="ax-wrap">
          <Link to="/docs/agents" className="ax-announce">
            <span>New</span> MCP server for Claude Code, Cursor and Codex <Arrow />
          </Link>
          <h1>
            Every event in your product.
            <br />
            <span className="ax-live">
              Live<span className="ax-live-dot" aria-hidden />
            </span>
          </h1>
          <p className="ax-lead">
            Send signups, payments, errors and deploys with one HTTP call. Watch them stream into a real-time feed, get
            pushed the ones that matter, and query everything with funnels, journeys and your AI agents.
          </p>
          <div className="ax-ctas">
            <Link to="/signup" search={AUTH} className="ax-btn ax-btn-accent">
              Start free <Arrow />
            </Link>
            <Link to="/docs" className="ax-btn ax-btn-line">
              Read the docs
            </Link>
            <span className="ax-fine">3,000 events/month free · no credit card</span>
          </div>
        </div>
        <div className="ax-wrap ax-app-wrap">
          <AppWindow />
        </div>
      </section>

      {/* Sources */}
      <section className="ax-wrap ax-sources">
        <p>SEND FROM ANYWHERE THAT CAN MAKE AN HTTP REQUEST</p>
        <div className="ax-marquee">
          <div>
            {[...SOURCES, ...SOURCES].map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="ax-wrap ax-section">
        <div className="ax-copy ax-copy-wide">
          <h2>
            Dashboards tell you what happened.
            <br />
            Raterlog tells you as it happens.
          </h2>
          <p>
            Analytics tools batch, sample and report tomorrow. Log tools bury the one line that matters under a million
            that don't. Raterlog keeps the events a human cares about in one place, in order, the second they occur.
          </p>
        </div>
        <div className="ax-trio">
          {[
            ["Seconds, not reports", "Events show up in the feed about a second after your POST. No ETL, no nightly job."],
            ["Signal, not noise", "Channels, tags and notify: true keep the stream readable for humans."],
            ["Every byte, kept", "Events live in a columnar store built for analytics. Up to three years of history on paid plans."],
          ].map(([h, b]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ingest + try it */}
      <section id="product" className="ax-wrap ax-section ax-split">
        <div className="ax-copy">
          <h2>One request. No SDK.</h2>
          <p>
            POST a JSON event from your backend, a webhook handler, a cron job or a CI step. Channels are created on first
            use, tags become filters, and <code>notify: true</code> pings your phone.
          </p>
          <p>The API is LogSnag-compatible, so existing integrations keep working when you switch.</p>
          <Learn to="/docs">Read the quickstart</Learn>
        </div>
        <TryIt />
      </section>

      {/* Push */}
      <section className="ax-wrap ax-section ax-split ax-split-rev">
        <div className="ax-copy">
          <h2>Pushed when it matters.</h2>
          <p>
            Mark the events a human should hear about and Raterlog sends them as notifications the moment they land. A
            failed payment or a usage spike reaches you before the support ticket does.
          </p>
          <p>Everything else waits quietly in the feed, searchable by channel, event, user, tag or text.</p>
          <Learn to="/docs">How notifications work</Learn>
        </div>
        <PushFragment />
      </section>

      {/* Journeys */}
      <section className="ax-wrap ax-section ax-split">
        <div className="ax-copy">
          <h2>Follow one user end to end.</h2>
          <p>
            Attach a <code>user_id</code> and every event becomes part of a journey. See exactly what a customer did before
            they upgraded, or before they churned, with their properties from <code>/v1/identify</code> alongside.
          </p>
          <p>Funnels use the same data: pick the steps, get conversion between each one.</p>
          <Learn to="/docs">Users and funnels</Learn>
        </div>
        <JourneyFragment />
      </section>

      {/* Statement */}
      <section className="ax-wrap ax-statement-wrap">
        <Statement />
      </section>

      {/* Agents */}
      <section id="agents" className="ax-wrap ax-section ax-split">
        <div className="ax-copy">
          <h2>
            Built for engineers
            <br />
            and their agents.
          </h2>
          <p>
            Raterlog ships a remote MCP server. Connect Claude Code, Cursor, Codex or VS Code in one command and your agent
            can query funnels, failed payments and user journeys, and log what it shipped.
          </p>
          <pre className="ax-cmd">
            <span className="ax-dim">$</span> claude mcp add --transport http raterlog {HOST}/mcp \{"\n"}
            {"    "}--header "Authorization: Bearer $RATERLOG_TOKEN"
          </pre>
          <Learn to="/docs/agents">Agent setup guide</Learn>
        </div>
        <div className="ax-frag">
          <div className="ax-card ax-card-agent">
            <AgentPane active />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="ax-wrap ax-section ax-split ax-split-pricing">
        <div className="ax-copy">
          <h2>Predictable from day one.</h2>
          <p>
            Free up to 3,000 events a month. Paid plans start at $12 and never drop your events: go over and we keep
            ingesting while you decide.
          </p>
          <p>Every plan has the full product: live feed, push, charts, funnels, journeys, insights and the MCP server.</p>
          <Learn to="/pricing">Compare plans</Learn>
        </div>
        <Pricing />
      </section>

      {/* Final CTA */}
      <section className="ax-final">
        <div className="ax-streaks ax-streaks-final" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="ax-wrap">
          <h2>Send your first event in two minutes.</h2>
          <p>Create a project, copy a token, POST to /v1/log. That's the whole setup.</p>
          <div className="ax-ctas ax-ctas-center">
            <Link to="/signup" search={AUTH} className="ax-btn ax-btn-accent">
              Start free <Arrow />
            </Link>
            <Link to="/docs" className="ax-btn ax-btn-line">
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ax-foot">
        <div className="ax-wrap">
          <div className="ax-foot-top">
            <div>
              <Link to="/" className="ax-logo">
                <img src="/icon.png" alt="" width={20} height={20} />
                Raterlog
              </Link>
              <p>Real-time event tracking for products and the agents that build them.</p>
            </div>
            <div className="ax-foot-cols">
              <div>
                <h5>Product</h5>
                <a href="#product">Ingest</a>
                <a href="#agents">Agents</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div>
                <h5>Developers</h5>
                <Link to="/docs">Docs</Link>
                <Link to="/docs/agents">MCP server</Link>
                <a href="/llms.txt">llms.txt</a>
              </div>
              <div>
                <h5>Account</h5>
                <Link to="/signin" search={AUTH}>
                  Sign in
                </Link>
                <Link to="/signup" search={AUTH}>
                  Start free
                </Link>
              </div>
            </div>
          </div>
          <div className="ax-foot-legal">
            <span>© {new Date().getFullYear()} Raterlog</span>
            <span>One Rust binary · LogSnag-compatible API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
