export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type User = { id: string; name: string; email: string };
export type Company = { id: string; name: string; billing: boolean };
export type Channel = {
  id: string;
  name: string;
  icon: string;
  companyID: string;
};
export type Token = {
  id: number;
  name: string;
  token: string;
  companyID: string;
};
export type Member = { id: string; name: string; email: string };
export type Invite = {
  id: string;
  email: string;
  companyID: string;
  token: string;
  status: string;
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
export type LogEvent = {
  channel_id: string;
  timestamp: string;
  event_name: string;
  event_payload: string;
  metadata: string | null;
};
export type AiSummary = {
  summary: string;
  event_counts: { name: string; count: number }[];
  anomalies: { event_name: string; count: number; reason: string }[];
  source: string;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const session = cookies().get("raterlog_session");
    if (session) {
      headers.set("Cookie", `raterlog_session=${session.value}`);
    }
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || res.statusText);
  }
  return data as T;
}

export async function apiOptional<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}
