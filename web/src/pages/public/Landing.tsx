import { Link } from "@tanstack/react-router";
import { Button, Card, Icon, type IconName } from "@blueprintjs/core";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LiveFeedMock } from "@/components/marketing/LiveFeedMock";
import { CodeTabs } from "@/components/marketing/CodeTabs";
import { INGEST_DOCS } from "@/lib/plans";
import "@/components/marketing/marketing.css";

const AUTH_SEARCH = { email: "", invite: "" };
const base = INGEST_DOCS.base;

const SNIPPETS = [
  {
    id: "curl",
    label: "curl",
    code: `curl -X POST ${base}/v1/log \\
  -H "Authorization: Bearer rl_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project": "my-saas",
    "channel": "payments",
    "event": "New Subscription",
    "description": "jane@acme.com · plan: pro",
    "icon": "💰",
    "notify": true,
    "tags": { "plan": "pro", "cycle": "yearly" },
    "user_id": "user_123"
  }'`,
  },
  {
    id: "js",
    label: "JavaScript",
    code: `await fetch("${base}/v1/log", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_your_token",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    project: "my-saas",
    channel: "payments",
    event: "New Subscription",
    description: "jane@acme.com · plan: pro",
    icon: "💰",
    notify: true,
    tags: { plan: "pro", cycle: "yearly" },
    user_id: "user_123",
  }),
});`,
  },
  {
    id: "py",
    label: "Python",
    code: `import requests

requests.post(
    "${base}/v1/log",
    headers={"Authorization": "Bearer rl_your_token"},
    json={
        "project": "my-saas",
        "channel": "payments",
        "event": "New Subscription",
        "description": "jane@acme.com · plan: pro",
        "icon": "💰",
        "notify": True,
        "tags": {"plan": "pro", "cycle": "yearly"},
        "user_id": "user_123",
    },
)`,
  },
];

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "feed",
    title: "Live feed",
    body: "Events stream in the moment they happen. Filter by channel, event, user or tag.",
  },
  {
    icon: "notifications",
    title: "Push notifications",
    body: "Mark an event notify: true and it reaches you instantly — wherever you are.",
  },
  {
    icon: "timeline-line-chart",
    title: "Charts",
    body: "Counts over time with breakdowns by channel, event name or user.",
  },
  {
    icon: "filter",
    title: "Funnels",
    body: "Define the steps that matter and watch where users drop off.",
  },
  {
    icon: "path",
    title: "User journeys",
    body: "Follow a single user through every event they triggered, in order.",
  },
  {
    icon: "changes",
    title: "Channels",
    body: "Organize events into streams — payments, ops, growth — each with its own feed.",
  },
  {
    icon: "lightbulb",
    title: "Insights",
    body: "Pin live KPIs — MRR, signups today, active users — updated from your backend.",
  },
  {
    icon: "predictive-analysis",
    title: "AI copilot",
    body: "Ask questions about your event stream in plain English and get answers.",
  },
];

const USE_CASES = [
  {
    title: "Know the moment revenue moves",
    body: "Log subscriptions, upgrades and failed charges from Stripe webhooks. See money events as they happen, not in tomorrow's report.",
  },
  {
    title: "Catch problems before tickets",
    body: "Send errors, timeouts and deploy events to an ops channel. A push notification beats a support email every time.",
  },
  {
    title: "Watch onboarding actually work",
    body: "Track signup → activate → invite as funnel steps. Find the step where new users silently churn.",
  },
  {
    title: "Keep the whole team in the loop",
    body: "Channels for growth, payments and ops mean everyone sees the events that matter to them — in real time.",
  },
];

const FAQ = [
  {
    q: "How is this different from product analytics tools?",
    a: "Analytics tools answer questions on a schedule. Raterlog shows you what's happening right now: the signup, the payment, the error — as it occurs, pushed to you.",
  },
  {
    q: "How do I send an event?",
    a: "One POST to /v1/log with a project, channel and event name. Works from your backend, a webhook handler, a cron job, or a curl one-liner. Channels are created automatically.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — 3,000 events per month, 3 seats and 30 days of history, free forever. No credit card required.",
  },
  {
    q: "What happens if I hit my event limit?",
    a: "Your dashboard shows a live usage meter and warns you before the cap. Upgrade in place or wait for the next billing cycle — you keep your data either way.",
  },
  {
    q: "Can I attach metadata to events?",
    a: "Yes — tags, descriptions, emoji icons and user IDs are all first-class fields, and they're all searchable from the feed.",
  },
  {
    q: "Where does my data live?",
    a: "In the same binary that serves this site — Raterlog is a single self-contained app with no external services required. Retention depends on your plan.",
  },
];

export default function Landing() {
  return (
    <div className="rl-page">
      <MarketingNav />

      <main>
        {/* Hero */}
        <div className="rl-wrap">
          <div className="rl-hero">
            <div>
              <span className="rl-badge">
                <Icon icon="pulse" size={11} /> Real-time product events
              </span>
              <h1 className="rl-h1">Every important moment in your product, in one live feed.</h1>
              <p className="rl-lead">
                Raterlog turns a single HTTP call into a real-time stream of the events that matter —
                signups, payments, errors — with push notifications, charts, funnels and insights built
                in.
              </p>
              <div className="rl-hero-ctas">
                <Link to="/signup" search={AUTH_SEARCH}>
                  <Button large intent="primary" text="Start free" rightIcon="arrow-right" />
                </Link>
                <Link to="/docs">
                  <Button large outlined text="Read the docs" icon="manual" />
                </Link>
              </div>
              <p className="rl-fine">Free plan · 3,000 events/month · No credit card required</p>
            </div>
            <LiveFeedMock />
          </div>
        </div>

        {/* One request */}
        <section className="rl-section rl-section-alt">
          <div className="rl-wrap">
            <p className="rl-eyebrow">Integration</p>
            <h2 className="rl-h2">One request. That's the whole SDK.</h2>
            <p className="rl-sub">
              No library to install, no batching, no config. POST an event from anywhere and it shows
              up in your feed — and your pocket — a second later.
            </p>
            <CodeTabs tabs={SNIPPETS} />
          </div>
        </section>

        {/* Features */}
        <section className="rl-section">
          <div className="rl-wrap">
            <p className="rl-eyebrow">Everything included</p>
            <h2 className="rl-h2">More than a log — a live picture of your product</h2>
            <p className="rl-sub">
              Every plan ships with the full toolkit. Send the event once; Raterlog does the rest.
            </p>
            <div className="rl-grid rl-grid-4">
              {FEATURES.map((f) => (
                <Card key={f.title} className="rl-feature">
                  <span className="rl-feature-icon">
                    <Icon icon={f.icon} size={16} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="rl-section rl-section-alt">
          <div className="rl-wrap">
            <p className="rl-eyebrow">Use cases</p>
            <h2 className="rl-h2">Built for the moments you can't afford to miss</h2>
            <div className="rl-grid rl-grid-2" style={{ marginTop: 32 }}>
              {USE_CASES.map((u) => (
                <Card key={u.title} className="rl-feature">
                  <h3 style={{ marginTop: 0 }}>{u.title}</h3>
                  <p>{u.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="rl-section">
          <div className="rl-wrap">
            <p className="rl-eyebrow">Pricing</p>
            <h2 className="rl-h2">Free to start. Cheap to keep.</h2>
            <p className="rl-sub">
              Start on a free plan with 3,000 events a month. Upgrade when your product does — plans
              from $12/month, and yearly billing gives you two months free.
            </p>
            <div className="rl-grid rl-grid-3">
              {[
                { name: "Free", price: "$0", note: "3,000 events/mo · 3 seats" },
                { name: "Starter", price: "$12", note: "50,000 events/mo · unlimited seats" },
                { name: "Growth", price: "$29", note: "250,000 events/mo · AI copilot" },
              ].map((p) => (
                <Card key={p.name} className="rl-feature">
                  <h3 style={{ marginTop: 0 }}>{p.name}</h3>
                  <div className="rl-price-row">
                    <span className="rl-price">{p.price}</span>
                    <span className="rl-price-per">/mo</span>
                  </div>
                  <p>{p.note}</p>
                </Card>
              ))}
            </div>
            <div style={{ marginTop: 24 }}>
              <Link to="/pricing">
                <Button text="See all plans and the full comparison" rightIcon="arrow-right" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="rl-section rl-section-alt">
          <div className="rl-wrap">
            <p className="rl-eyebrow">FAQ</p>
            <h2 className="rl-h2">Questions, answered</h2>
            <div className="rl-grid rl-grid-2" style={{ marginTop: 32 }}>
              {FAQ.map((f) => (
                <div key={f.q} className="rl-faq-item">
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="rl-cta">
          <div className="rl-wrap">
            <h2 className="rl-h2">Start seeing your product in real time.</h2>
            <p className="rl-sub" style={{ margin: "0 auto 28px", textAlign: "center" }}>
              Create a project, copy a token, send your first event. Two minutes, tops.
            </p>
            <Link to="/signup" search={AUTH_SEARCH}>
              <Button large intent="primary" text="Start free" rightIcon="arrow-right" />
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
