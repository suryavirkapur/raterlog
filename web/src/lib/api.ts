// Typed client for the Rust API. The SPA is served by the same binary, so all
// requests are same-origin and the httpOnly `raterlog_session` cookie is sent
// automatically. This file is the API contract: the backend implements exactly
// these endpoints (see api/src/routes/*).
//
// Naming: the backend calls a tenant a "company"; the UI calls it a "project"
// (LogSnag terminology). `companyId` === project id.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText);
  return data as T;
}

const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

// ───────────────────────── Types ─────────────────────────

export type User = { id: string; name: string; email: string };
export type Company = { id: string; name: string; billing: boolean };
export type Channel = { id: string; name: string; icon: string; companyID: string };
/** Token scope: `ingest` writes only, `read` reads only (MCP read tools, feed), `full` does both. */
export type TokenScope = "ingest" | "read" | "full";
export type Token = { id: number; name: string; token: string; scope: TokenScope; companyID: string };
export type Member = { id: string; name: string; email: string };
export type Invite = {
  id: string;
  email: string;
  companyID: string;
  token: string; // invite link = `${location.origin}/invite/${token}`
  status: "pending" | "accepted" | string;
  createdAt: string;
  expiresAt: string;
  companyName?: string;
};
export type Insight = {
  id: string;
  companyID: string;
  title: string;
  value: string;
  icon?: string | null;
  updatedAt: string;
};
export type IdentifiedUser = {
  id: string;
  companyID: string;
  userId: string;
  properties: Record<string, unknown>;
  updatedAt: string;
};
export type CompanyDetail = {
  company: Company;
  channels: Channel[];
  tokens: Token[];
  members: Member[];
  invites: Invite[];
  insights: Insight[];
  identifiedUsers: IdentifiedUser[];
};

/** One ingested event. `id` is a numeric string that increases over time. */
export type RlEvent = {
  id: string;
  channel_id: string;
  channel: string; // channel name
  event: string; // e.g. "New Subscription"
  description: string; // markdown or plain text
  icon: string; // emoji
  tags: Record<string, string>;
  user_id: string; // "" when not set
  notify: boolean;
  timestamp: string; // ISO 8601
};

export type EventFilter = {
  channel?: string; // channel id
  event?: string; // exact event name
  user_id?: string;
  tag?: string; // "key:value"
  q?: string; // free-text search over event + description
  before?: string; // id cursor: older than this (pagination)
  since?: string; // id cursor: newer than this (live polling)
  limit?: number; // default 50, max 500
};

export type Range = "24h" | "7d" | "30d" | "90d";
export type Interval = "hour" | "day";
export type SeriesPoint = { t: string; count: number }; // t = bucket start, ISO
export type BreakdownRow = { key: string; count: number };
export type FunnelStep = { event: string; count: number };

export type Usage = {
  plan: PlanId;
  period_start: string;
  period_end: string;
  events_used: number;
  events_limit: number; // -1 = unlimited
  seats_used: number;
  seats_limit: number; // -1 = unlimited
  retention_days: number;
};
export type PlanId = "free" | "starter" | "growth" | "scale";
export type Plan = {
  id: PlanId;
  name: string;
  price_month: number; // USD per month, billed monthly
  price_year: number; // USD per year, billed annually
  events_limit: number;
  seats_limit: number; // -1 = unlimited
  retention_days: number;
  features: string[];
};
export type AiSummary = {
  summary: string;
  event_counts: { name: string; count: number }[];
  anomalies: { event_name: string; count: number; reason: string }[];
  source: string;
};

// ───────────────────────── Endpoints ─────────────────────────

export const auth = {
  me: () => api<User>("/api/auth/me"),
  signin: (b: { email: string; password: string; invite_token?: string }) =>
    post<User>("/api/auth/signin", b),
  signup: (b: { name: string; email: string; password: string; invite_token?: string }) =>
    post<User>("/api/auth/signup", b),
  signout: () => post<unknown>("/api/auth/signout"),
};

export const projects = {
  list: () => api<Company[]>("/api/companies"),
  create: (name: string) => post<Company>("/api/companies", { name }),
  get: (id: string) => api<CompanyDetail>(`/api/companies/${id}`),
  rename: (id: string, name: string) => patch<Company>(`/api/companies/${id}`, { name }),

  createChannel: (id: string, name: string, icon: string) =>
    post<Channel>(`/api/companies/${id}/channels`, { name, icon }),
  deleteChannel: (id: string, channelId: string) =>
    del<unknown>(`/api/companies/${id}/channels/${channelId}`),

  createToken: (id: string, name: string, scope: TokenScope = "ingest") =>
    post<Token>(`/api/companies/${id}/tokens`, { name, scope }),
  deleteToken: (id: string, tokenId: number) => del<unknown>(`/api/companies/${id}/tokens/${tokenId}`),

  invite: (id: string, email: string) => post<Invite>(`/api/companies/${id}/invites`, { email }),
  revokeInvite: (id: string, inviteId: string) => del<unknown>(`/api/companies/${id}/invites/${inviteId}`),
};

export const invites = {
  get: (token: string) => api<Invite>(`/api/invites/${token}`),
  accept: (token: string) => post<unknown>(`/api/invites/${token}/accept`),
};

export const events = {
  /** Newest first. Poll with `since` = newest id you have to get only new events. */
  list: (projectId: string, f: EventFilter = {}) =>
    api<RlEvent[]>(`/api/companies/${projectId}/events${qs(f as any)}`),
};

export type AnalyticsSummary = { total: number; unique_users: number; today: number; yesterday: number };

export const analytics = {
  /** Exact totals for the range (+ today / yesterday, UTC days). Use this for KPI tiles. */
  summary: (projectId: string, range: Range) =>
    api<AnalyticsSummary>(`/api/companies/${projectId}/analytics/summary${qs({ range })}`),
  timeseries: (
    projectId: string,
    p: { range: Range; interval: Interval; channel?: string; event?: string },
  ) => api<SeriesPoint[]>(`/api/companies/${projectId}/analytics/timeseries${qs(p)}`),
  breakdown: (
    projectId: string,
    p: { range: Range; by: "event" | "channel" | "user"; channel?: string; limit?: number },
  ) => api<BreakdownRow[]>(`/api/companies/${projectId}/analytics/breakdown${qs(p)}`),
  funnel: (projectId: string, b: { steps: string[]; range: Range; window_hours: number }) =>
    post<FunnelStep[]>(`/api/companies/${projectId}/analytics/funnel`, b),
};

export const users = {
  list: (projectId: string) => api<IdentifiedUser[]>(`/api/companies/${projectId}/users`),
  /** Profile + full event journey (newest first). `user` is null if never identified. */
  get: (projectId: string, userId: string) =>
    api<{ user: IdentifiedUser | null; events: RlEvent[] }>(
      `/api/companies/${projectId}/users/${encodeURIComponent(userId)}`,
    ),
};

export const billing = {
  plans: () => api<Plan[]>("/api/plans"),
  usage: (projectId: string) => api<Usage>(`/api/companies/${projectId}/usage`),
  /** Returns a hosted checkout URL; redirect with window.location.assign(url). 503 if billing is not configured. */
  checkout: (projectId: string, plan: PlanId, interval: "month" | "year") =>
    post<{ url: string }>(`/api/companies/${projectId}/billing/checkout`, { plan, interval }),
  portal: (projectId: string) => post<{ url: string }>(`/api/companies/${projectId}/billing/portal`),
};

export type WebhookSource = "stripe" | "github" | "vercel" | "dodo" | "generic";

export const integrations = {
  /** Sources that have a webhook signing secret configured (secrets are never returned). */
  list: (projectId: string) =>
    api<{ sources: WebhookSource[] }>(`/api/companies/${projectId}/integrations`),
  setSecret: (projectId: string, source: WebhookSource, secret: string) =>
    put<{ ok: boolean }>(`/api/companies/${projectId}/integrations/${source}`, { secret }),
  clearSecret: (projectId: string, source: WebhookSource) =>
    del<{ ok: boolean }>(`/api/companies/${projectId}/integrations/${source}`),
};

export const ai = {
  summarize: (channelId: string) => post<AiSummary>(`/api/channels/${channelId}/ai/summarize`),
  ask: (channelId: string, question: string) =>
    post<{ answer: string; summary: AiSummary }>(`/api/channels/${channelId}/ai/query`, { question }),
};
