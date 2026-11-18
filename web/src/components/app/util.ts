// Small helpers shared by the app pages.
import type { RlEvent } from "@/lib/api";
import { toast } from "@/lib/toaster";

export function fmtNum(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: n >= 10000 ? "compact" : "standard" }).format(n);
}

/** "3s ago", "5m ago", "2h ago", "4d ago", "2mo ago" */
export function relTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.round((now - t) / 1000);
  if (s < 0 || s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function absTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** "Today", "Yesterday", or a date label for grouping feed rows. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function errMsg(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    await toast({ message: label, intent: "success", icon: "clipboard" });
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      await toast({ message: label, intent: "success", icon: "clipboard" });
    } catch {
      await toast({ message: "Copy failed", intent: "danger", icon: "error" });
    }
    ta.remove();
  }
}

/** Rebuild a `curl` command that reproduces the event via POST /v1/log. */
export function eventToCurl(ev: RlEvent, projectName: string, origin: string): string {
  const body: Record<string, unknown> = {
    project: projectName,
    channel: ev.channel,
    event: ev.event,
  };
  if (ev.description) body.description = ev.description;
  if (ev.icon) body.icon = ev.icon;
  if (ev.notify) body.notify = true;
  if (ev.tags && Object.keys(ev.tags).length > 0) body.tags = ev.tags;
  if (ev.user_id) body.user_id = ev.user_id;
  const json = JSON.stringify(body).replace(/'/g, `'\\''`);
  return [
    `curl -X POST '${origin}/v1/log' \\`,
    `  -H 'Authorization: Bearer <API token>' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${json}'`,
  ].join("\n");
}
