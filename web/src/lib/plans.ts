// Plan catalogue. Mirrors api/src/billing.rs (served at GET /api/plans).
// Use this as the fallback when the endpoint is unavailable (e.g. landing page).
import type { Plan } from "./api";

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price_month: 0,
    price_year: 0,
    events_limit: 3000,
    seats_limit: 3,
    retention_days: 30,
    features: ["3,000 events / month", "3 seats", "30-day history", "Live feed & push notifications"],
  },
  {
    id: "starter",
    name: "Starter",
    price_month: 12,
    price_year: 120,
    events_limit: 50000,
    seats_limit: -1,
    retention_days: 365,
    features: ["50,000 events / month", "Unlimited seats", "1-year history", "Charts, funnels & journeys"],
  },
  {
    id: "growth",
    name: "Growth",
    price_month: 29,
    price_year: 290,
    events_limit: 250000,
    seats_limit: -1,
    retention_days: 730,
    features: ["250,000 events / month", "Unlimited seats", "2-year history", "AI copilot", "Priority support"],
  },
  {
    id: "scale",
    name: "Scale",
    price_month: 59,
    price_year: 590,
    events_limit: 1000000,
    seats_limit: -1,
    retention_days: 1095,
    features: ["1,000,000 events / month", "Unlimited seats", "3-year history", "AI copilot", "Priority support"],
  },
];

export const INGEST_DOCS = {
  base: typeof location !== "undefined" ? location.origin : "https://raterlog.com",
  log: {
    method: "POST",
    path: "/v1/log",
    body: {
      project: "my-saas",
      channel: "payments",
      event: "New Subscription",
      description: "email: jane@example.com",
      icon: "💰",
      notify: true,
      tags: { plan: "pro", cycle: "yearly" },
      user_id: "user_123",
    },
  },
  identify: { method: "POST", path: "/v1/identify", body: { project: "my-saas", user_id: "user_123", properties: { name: "Jane", plan: "pro" } } },
  insight: { method: "POST", path: "/v1/insight", body: { project: "my-saas", title: "MRR", value: "$1,240", icon: "💸" } },
  insightInc: { method: "PATCH", path: "/v1/insight", body: { project: "my-saas", title: "Signups today", value: { $inc: 1 }, icon: "🙋" } },
  auth: "Authorization: Bearer <API token>",
  note: "`project` is the project name exactly as shown in the dashboard. Channels are created automatically on first event.",
} as const;
