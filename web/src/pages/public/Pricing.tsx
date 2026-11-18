import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  Card,
  HTMLTable,
  Icon,
  SegmentedControl,
  Tag,
} from "@blueprintjs/core";
import { billing, type Plan, type PlanId } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { useAsync } from "@/lib/hooks";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import "@/components/marketing/marketing.css";

const AUTH_SEARCH = { email: "", invite: "" };

function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}

function retentionLabel(days: number) {
  if (days >= 365 && days % 365 === 0) return `${days / 365} year${days > 365 ? "s" : ""}`;
  return `${days} days`;
}

const FAQ = [
  {
    q: "What counts as an event?",
    a: "Every call to /v1/log. Identify calls, insights and reads are free — you only pay for the events you ingest.",
  },
  {
    q: "Can I change plans later?",
    a: "Any time. Upgrades apply immediately; downgrades take effect at the start of the next billing cycle.",
  },
  {
    q: "What does '2 months free' mean?",
    a: "Yearly plans cost ten times the monthly price, so a year of Raterlog costs the same as ten monthly payments.",
  },
  {
    q: "What happens when I reach my event limit?",
    a: "We warn you in the dashboard as you approach it. You can upgrade in place — your history and settings carry over.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, from the billing portal in project settings. You keep access until the end of the paid period and drop to the free plan after.",
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(true);
  const { data: plans } = useAsync<Plan[]>(
    () => billing.plans().catch(() => PLANS),
    [],
  );
  const list = plans ?? PLANS;

  return (
    <div className="rl-page">
      <MarketingNav />
      <main className="rl-wrap" style={{ paddingTop: 64, paddingBottom: 72, flex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p className="rl-eyebrow" style={{ marginBottom: 8 }}>
            Pricing
          </p>
          <h1 className="rl-h2" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
            Start free. Scale when you do.
          </h1>
          <p className="rl-sub" style={{ margin: "0 auto 24px", textAlign: "center" }}>
            Every plan includes the live feed, push notifications and unlimited projects.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <SegmentedControl
              value={yearly ? "year" : "month"}
              onValueChange={(v) => setYearly(v === "year")}
              options={[
                { label: "Monthly", value: "month" },
                { label: "Yearly", value: "year" },
              ]}
            />
            {yearly && (
              <Tag intent="success" minimal round>
                2 months free
              </Tag>
            )}
          </div>
        </div>

        <div className="rl-grid rl-grid-4" style={{ marginBottom: 64 }}>
          {list.map((p) => {
            const free = p.price_month === 0;
            const price = yearly ? Math.round(p.price_year / 12) : p.price_month;
            return (
              <Card
                key={p.id}
                className={`rl-plan-card${p.id === "growth" ? " rl-plan-pop" : ""}`}
                elevation={1}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{p.name}</h3>
                  {p.id === "growth" && (
                    <Tag intent="primary" minimal>
                      Popular
                    </Tag>
                  )}
                </div>
                <div className="rl-price-row">
                  <span className="rl-price">${free ? 0 : price}</span>
                  <span className="rl-price-per">/mo</span>
                </div>
                <p className="rl-fine" style={{ minHeight: 18 }}>
                  {free
                    ? "free forever"
                    : yearly
                      ? `billed $${p.price_year}/year`
                      : "billed monthly"}
                </p>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Icon icon="tick" size={13} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" search={AUTH_SEARCH}>
                  <Button
                    fill
                    intent={p.id === "growth" ? "primary" : "none"}
                    outlined={p.id !== "growth"}
                    text={free ? "Start free" : `Choose ${p.name}`}
                  />
                </Link>
              </Card>
            );
          })}
        </div>

        <h2 className="rl-h2" style={{ fontSize: 24 }}>
          Compare plans
        </h2>
        <p className="rl-sub">The full feature breakdown, plan by plan.</p>
        <div className="rl-table-wrap" style={{ marginBottom: 64 }}>
          <HTMLTable compact bordered>
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>&nbsp;</th>
                {list.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Events / month</td>
                {list.map((p) => (
                  <td key={p.id}>{fmtNum(p.events_limit)}</td>
                ))}
              </tr>
              <tr>
                <td>Seats</td>
                {list.map((p) => (
                  <td key={p.id}>{p.seats_limit === -1 ? "Unlimited" : p.seats_limit}</td>
                ))}
              </tr>
              <tr>
                <td>Event history</td>
                {list.map((p) => (
                  <td key={p.id}>{retentionLabel(p.retention_days)}</td>
                ))}
              </tr>
              {(
                [
                  ["Live feed & notifications", () => true],
                  ["Channels, tags & users", () => true],
                  ["Charts & funnels", (id: PlanId) => id !== "free"],
                  ["AI copilot", (id: PlanId) => id === "growth" || id === "scale"],
                  ["Priority support", (id: PlanId) => id === "growth" || id === "scale"],
                ] as [string, (id: PlanId) => boolean][]
              ).map(([label, ok]) => (
                <tr key={label}>
                  <td>{label}</td>
                  {list.map((p) => (
                    <td key={p.id}>
                      {ok(p.id) ? (
                        <Icon icon="tick" intent="success" />
                      ) : (
                        <span style={{ color: "var(--rl-mk-muted)" }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </div>

        <h2 className="rl-h2" style={{ fontSize: 24 }}>
          Questions
        </h2>
        <div className="rl-grid rl-grid-2" style={{ marginTop: 24 }}>
          {FAQ.map((f) => (
            <div key={f.q} className="rl-faq-item">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
