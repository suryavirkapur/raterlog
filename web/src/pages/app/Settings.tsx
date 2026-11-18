import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Callout,
  Card,
  Classes,
  Dialog,
  FormGroup,
  H5,
  HTMLTable,
  Icon,
  InputGroup,
  Intent,
  ProgressBar,
  SegmentedControl,
  Tab,
  Tabs,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import {
  ApiError,
  billing,
  integrations,
  projects,
  type CompanyDetail,
  type Invite,
  type Plan,
  type PlanId,
  type Token,
  type TokenScope,
  type Usage,
  type WebhookSource,
} from "@/lib/api";
import { useProject, useSession } from "@/lib/context";
import { useAsync, useLocalState } from "@/lib/hooks";
import { PLANS } from "@/lib/plans";
import { toast, toastError } from "@/lib/toaster";
import { PageHeader } from "@/components/app/PageHeader";
import { RelativeTime } from "@/components/app/RelativeTime";
import { copyText, errMsg, fmtNum } from "@/components/app/util";

type TabId = "general" | "tokens" | "integrations" | "members" | "billing";

export default function Settings() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { tab } = useSearch({ strict: false }) as { tab: TabId };
  const navigate = useNavigate();
  const { detail, reload } = useProject();
  const usage = useAsync(() => billing.usage(projectId).catch(() => undefined), [projectId]);

  return (
    <div className="rl-page rl-page-narrow">
      <PageHeader title="Settings" subtitle={detail.company.name} />
      <Tabs
        id="settings-tabs"
        large
        selectedTabId={tab}
        onChange={(id) =>
          void navigate({
            to: "/app/$projectId/settings",
            params: { projectId },
            replace: true,
            search: { tab: id as TabId },
          })
        }
      >
        <Tab id="general" title="General" panel={<GeneralTab projectId={projectId} detail={detail} reload={reload} />} />
        <Tab id="tokens" title="API tokens" panel={<TokensTab projectId={projectId} detail={detail} reload={reload} />} />
        <Tab
          id="integrations"
          title="Integrations"
          panel={<IntegrationsTab projectId={projectId} detail={detail} />}
        />
        <Tab
          id="members"
          title="Members"
          panel={<MembersTab projectId={projectId} detail={detail} reload={reload} usage={usage.data} />}
        />
        <Tab
          id="billing"
          title="Billing"
          panel={<BillingTab projectId={projectId} detail={detail} usage={usage.data} usageLoading={usage.loading} />}
        />
      </Tabs>
    </div>
  );
}

/* ── General ─────────────────────────────────── */

function GeneralTab({
  projectId,
  detail,
  reload,
}: {
  projectId: string;
  detail: CompanyDetail;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(detail.company.name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(detail.company.name), [detail.company.name]);

  const dirty = name.trim() !== "" && name.trim() !== detail.company.name;

  const save = async () => {
    setSaving(true);
    try {
      await projects.rename(projectId, name.trim());
      await reload();
      await toast({ message: "Project renamed", intent: "success", icon: "tick" });
    } catch (e) {
      toastError(e, "Couldn't rename project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card compact style={{ maxWidth: 560, marginTop: 12 }}>
      <H5>Project</H5>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) void save();
        }}
      >
        <FormGroup label="Name" labelFor="project-name">
          <InputGroup id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormGroup>
        <Button intent="primary" text="Save" type="submit" loading={saving} disabled={!dirty} />
      </form>
      <FormGroup label="Project id" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <code className="rl-code" style={{ flex: 1, overflowWrap: "anywhere" }}>
            {projectId}
          </code>
          <Button small minimal icon="duplicate" text="Copy" onClick={() => copyText(projectId, "Project id copied")} />
        </div>
      </FormGroup>
    </Card>
  );
}

/* ── Tokens ──────────────────────────────────── */

function TokensTab({
  projectId,
  detail,
  reload,
}: {
  projectId: string;
  detail: CompanyDetail;
  reload: () => Promise<void>;
}) {
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenScope, setTokenScope] = useState<TokenScope>("ingest");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Token | null>(null);
  const [toDelete, setToDelete] = useState<Token | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleReveal = (id: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    if (!tokenName.trim()) return;
    setCreating(true);
    try {
      const t = await projects.createToken(projectId, tokenName.trim(), tokenScope);
      setCreated(t);
      void reload();
    } catch (e) {
      toastError(e, "Couldn't create token");
    } finally {
      setCreating(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await projects.deleteToken(projectId, toDelete.id);
      await toast({ message: `Token "${toDelete.name}" deleted`, intent: "success", icon: "tick" });
      setToDelete(null);
      void reload();
    } catch (e) {
      toastError(e, "Couldn't delete token");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card compact style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <H5 style={{ margin: 0 }}>API tokens</H5>
        <Button
          small
          intent="primary"
          icon="plus"
          text="New token"
          onClick={() => {
            setCreated(null);
            setTokenName("");
            setTokenScope("ingest");
            setCreateOpen(true);
          }}
        />
      </div>
      {detail.tokens.length === 0 ? (
        <div className="rl-muted" style={{ fontSize: 13, padding: "8px 0" }}>
          No tokens yet — create one to send events to <code className="rl-code">/v1/log</code>.
        </div>
      ) : (
        <div className="rl-table-wrap">
          <HTMLTable compact interactive style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope</th>
                <th>Token</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {detail.tokens.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>
                    <Tag minimal intent={t.scope === "full" ? "primary" : "none"}>
                      {t.scope}
                    </Tag>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <code className="rl-code">{revealed.has(t.id) ? t.token : "••••••••••••••••"}</code>
                      <Button
                        small
                        minimal
                        icon={revealed.has(t.id) ? "eye-off" : "eye-open"}
                        title={revealed.has(t.id) ? "Hide" : "Reveal"}
                        onClick={() => toggleReveal(t.id)}
                      />
                      <Button small minimal icon="duplicate" title="Copy" onClick={() => copyText(t.token, "Token copied")} />
                    </span>
                  </td>
                  <td>
                    <Button small minimal icon="trash" intent="danger" title="Delete" onClick={() => setToDelete(t)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </div>
      )}

      <Dialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={created ? "Token created" : "New API token"}
        icon="key"
        style={{ width: 440 }}
      >
        <div className={Classes.DIALOG_BODY}>
          {created ? (
            <>
              <Callout intent="success" title={created.name}>
                This is the only time the token is shown. Store it somewhere safe.
              </Callout>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
                <code className="rl-code" style={{ flex: 1, overflowWrap: "anywhere", fontSize: 13 }}>
                  {created.token}
                </code>
                <Button small icon="duplicate" text="Copy" onClick={() => copyText(created.token, "Token copied")} />
              </div>
              <pre className="rl-pre" style={{ marginTop: 12 }}>
                {`curl -X POST '${location.origin}/v1/log' \\
  -H 'Authorization: Bearer ${created.token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"project":"${detail.company.name}","channel":"test","event":"Hello 👋"}'`}
              </pre>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <FormGroup label="Token name" labelFor="token-name" helperText="e.g. production, staging, jane's laptop">
                <InputGroup id="token-name" autoFocus value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
              </FormGroup>
              <FormGroup
                label="Scope"
                helperText="ingest can only send data · read can only query it (feed, MCP read tools) · full does both"
              >
                <SegmentedControl
                  value={tokenScope}
                  onValueChange={(v) => setTokenScope(v as TokenScope)}
                  options={[
                    { label: "Ingest", value: "ingest" },
                    { label: "Read", value: "read" },
                    { label: "Full", value: "full" },
                  ]}
                />
              </FormGroup>
            </form>
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            {created ? (
              <Button intent="primary" text="Done" onClick={() => setCreateOpen(false)} />
            ) : (
              <>
                <Button text="Cancel" onClick={() => setCreateOpen(false)} />
                <Button
                  intent="primary"
                  text="Create token"
                  icon="plus"
                  loading={creating}
                  disabled={!tokenName.trim()}
                  onClick={() => void create()}
                />
              </>
            )}
          </div>
        </div>
      </Dialog>

      <Alert
        isOpen={toDelete != null}
        icon="trash"
        intent="danger"
        canEscapeKeyCancel
        canOutsideClickCancel
        cancelButtonText="Cancel"
        confirmButtonText="Delete token"
        loading={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      >
        <p>
          Delete token <b>{toDelete?.name}</b>? Any integration using it will stop working immediately.
        </p>
      </Alert>
    </Card>
  );
}

/* ── Integrations ────────────────────────────── */

const WEBHOOK_SOURCES: {
  id: WebhookSource;
  name: string;
  channel: string;
  secretLabel: string;
  steps: string[];
}[] = [
  {
    id: "stripe",
    name: "Stripe",
    channel: "payments",
    secretLabel: "Signing secret (whsec_…)",
    steps: [
      "Stripe Dashboard → Developers → Webhooks → Add endpoint",
      "Paste the webhook URL below",
      "Pick events (subscriptions, invoices, refunds…) and save",
      "Copy the endpoint's signing secret into the field below",
    ],
  },
  {
    id: "github",
    name: "GitHub",
    channel: "github",
    secretLabel: "Webhook secret",
    steps: [
      "Repo or org → Settings → Webhooks → Add webhook",
      "Paste the webhook URL, set Content type to application/json",
      "Optionally set a secret and save it below too",
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    channel: "deploys",
    secretLabel: "Webhook secret",
    steps: [
      "Project → Settings → Webhooks → Create",
      "Paste the webhook URL and pick deployment events",
      "Copy the generated secret into the field below",
    ],
  },
  {
    id: "dodo",
    name: "Dodo Payments",
    channel: "payments",
    secretLabel: "Signing secret (whsec_…)",
    steps: [
      "Dodo Dashboard → Developer → Webhooks → Add endpoint",
      "Paste the webhook URL and select payment/subscription events",
      "Copy the signing secret into the field below",
    ],
  },
  {
    id: "generic",
    name: "Generic JSON",
    channel: "webhooks",
    secretLabel: "Secret (X-Hub-Signature-256)",
    steps: [
      "Point any service that can POST JSON at the webhook URL",
      "Body may set event, description, channel, icon, tags, user_id",
      "Optional: send X-Hub-Signature-256 (sha256=<hex HMAC>) with a secret",
    ],
  },
];

function IntegrationCard({
  projectId,
  source,
  webhookUrl,
  configured,
  reload,
}: {
  projectId: string;
  source: (typeof WEBHOOK_SOURCES)[number];
  webhookUrl: string;
  configured: boolean;
  reload: () => Promise<void>;
}) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!secret.trim()) return;
    setBusy(true);
    try {
      await integrations.setSecret(projectId, source.id, secret.trim());
      setSecret("");
      await toast({ message: `${source.name} secret saved — signatures are now verified`, intent: "success", icon: "tick" });
      await reload();
    } catch (e) {
      toastError(e, "Couldn't save secret");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await integrations.clearSecret(projectId, source.id);
      await toast({ message: `${source.name} secret removed`, intent: "success", icon: "tick" });
      await reload();
    } catch (e) {
      toastError(e, "Couldn't remove secret");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card compact>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <H5 style={{ margin: 0 }}>{source.name}</H5>
        <div style={{ display: "flex", gap: 6 }}>
          <Tag minimal icon="feed">
            {source.channel}
          </Tag>
          {configured ? (
            <Tag minimal intent="success" icon="lock">
              signed
            </Tag>
          ) : (
            <Tag minimal icon="unlock">
              unsigned
            </Tag>
          )}
        </div>
      </div>
      <ol className="rl-muted" style={{ fontSize: 12.5, margin: "0 0 10px", paddingLeft: 18 }}>
        {source.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <FormGroup label="Webhook URL" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <code className="rl-code" style={{ flex: 1, overflowWrap: "anywhere", fontSize: 12 }}>
            {webhookUrl}
          </code>
          <Button small minimal icon="duplicate" text="Copy" onClick={() => copyText(webhookUrl, "Webhook URL copied")} />
        </div>
      </FormGroup>
      <FormGroup label={source.secretLabel} helperText="Optional — when set, deliveries are signature-verified." style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <InputGroup
            small
            fill
            type="password"
            placeholder={configured ? "•••••••• (replace)" : "Paste the provider's secret"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <Button
            small
            intent="primary"
            text={configured ? "Replace" : "Save"}
            icon="floppy-disk"
            loading={busy}
            disabled={!secret.trim()}
            onClick={() => void save()}
          />
          {configured && (
            <Button small minimal intent="danger" icon="trash" text="Clear" loading={busy} onClick={() => void clear()} />
          )}
        </div>
      </FormGroup>
    </Card>
  );
}

function IntegrationsTab({ projectId, detail }: { projectId: string; detail: CompanyDetail }) {
  const integ = useAsync(() => integrations.list(projectId), [projectId]);
  const configured = new Set(integ.data?.sources ?? []);
  // Prefer an ingest-only token: it ends up in third-party webhook URLs, so it must not be able to read.
  const token = (detail.tokens.find((t) => t.scope === "ingest") ?? detail.tokens.find((t) => t.scope === "full"))?.token;

  return (
    <div className="rl-stack" style={{ marginTop: 12 }}>
      <Callout compact icon="satellite" style={{ marginBottom: 0 }}>
        Point a provider's webhook at its URL below and deliveries become Raterlog events — no code
        needed. The token in the URL identifies this project.
      </Callout>
      {!token && (
        <Callout intent="warning" icon="key">
          This project has no ingest token yet — create one in <strong>API tokens</strong> first; it
          becomes part of every webhook URL.
        </Callout>
      )}
      {WEBHOOK_SOURCES.map((s) => (
        <IntegrationCard
          key={s.id}
          projectId={projectId}
          source={s}
          webhookUrl={`${location.origin}/v1/webhooks/${s.id}/${token ?? "YOUR_TOKEN"}`}
          configured={configured.has(s.id)}
          reload={integ.reload}
        />
      ))}
    </div>
  );
}

/* ── Members ─────────────────────────────────── */

function MembersTab({
  projectId,
  detail,
  reload,
  usage,
}: {
  projectId: string;
  detail: CompanyDetail;
  reload: () => Promise<void>;
  usage?: Usage;
}) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const pending = detail.invites.filter((i) => i.status === "pending");
  const seatsUsed = usage?.seats_used ?? detail.members.length + pending.length;
  const seatsLimit = usage?.seats_limit ?? PLANS.find((p) => p.id === "free")!.seats_limit;
  const seatText = seatsLimit === -1 ? `${seatsUsed} / unlimited` : `${seatsUsed} / ${seatsLimit}`;

  const invite = async () => {
    const em = email.trim();
    if (!em) return;
    setInviting(true);
    try {
      const inv = await projects.invite(projectId, em);
      setEmail("");
      await toast({ message: `Invited ${em}`, intent: "success", icon: "envelope" });
      void reload();
      void copyText(`${location.origin}/invite/${inv.token}`, "Invite link copied");
    } catch (e) {
      toastError(e, "Couldn't send invite");
    } finally {
      setInviting(false);
    }
  };

  const revoke = async (inv: Invite) => {
    setRevoking(inv.id);
    try {
      await projects.revokeInvite(projectId, inv.id);
      await toast({ message: "Invite revoked", intent: "success", icon: "tick" });
      void reload();
    } catch (e) {
      toastError(e, "Couldn't revoke invite");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="rl-stack" style={{ marginTop: 12 }}>
      <Card compact>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <H5 style={{ margin: 0 }}>Members</H5>
          <Tag minimal icon="people">
            {seatText} seats
          </Tag>
        </div>
        <div className="rl-table-wrap">
          <HTMLTable compact style={{ width: "100%" }}>
            <tbody>
              {detail.members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td className="rl-muted">{m.email}</td>
                  <td style={{ textAlign: "right" }}>
                    {m.email === session.email && <Tag minimal intent="primary">you</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </div>

        <form
          style={{ display: "flex", gap: 8, marginTop: 14, maxWidth: 460 }}
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
        >
          <InputGroup
            small
            fill
            leftIcon="envelope"
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button small intent="primary" icon="new-person" text="Invite" type="submit" loading={inviting} disabled={!email.trim()} />
        </form>
      </Card>

      {pending.length > 0 && (
        <Card compact>
          <H5>Pending invites</H5>
          <div className="rl-table-wrap">
            <HTMLTable compact style={{ width: "100%" }}>
              <tbody>
                {pending.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td className="rl-muted" style={{ whiteSpace: "nowrap" }}>
                      invited <RelativeTime iso={inv.createdAt} />
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Tooltip content="Copy invite link" placement="left">
                        <Button
                          small
                          minimal
                          icon="link"
                          onClick={() => copyText(`${location.origin}/invite/${inv.token}`, "Invite link copied")}
                        />
                      </Tooltip>
                      <Button
                        small
                        minimal
                        intent="danger"
                        icon="cross"
                        title="Revoke"
                        loading={revoking === inv.id}
                        onClick={() => void revoke(inv)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Billing ─────────────────────────────────── */

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit === -1) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div className="rl-stat-label" style={{ marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13 }}>
          {fmtNum(used)} <span className="rl-muted">— unlimited</span>
        </div>
      </div>
    );
  }
  const pct = limit > 0 ? used / limit : 0;
  const intent = pct >= 1 ? Intent.DANGER : pct > 0.8 ? Intent.WARNING : Intent.PRIMARY;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
        <span className="rl-stat-label">{label}</span>
        <span className="rl-muted">
          {fmtNum(used)} / {fmtNum(limit)} ({Math.round(pct * 100)}%)
        </span>
      </div>
      <ProgressBar value={Math.min(pct, 1)} intent={intent} animate={false} stripes={false} />
    </div>
  );
}

function BillingTab({
  projectId,
  detail,
  usage,
  usageLoading,
}: {
  projectId: string;
  detail: CompanyDetail;
  usage?: Usage;
  usageLoading: boolean;
}) {
  const plans = useAsync(() => billing.plans().catch(() => PLANS), []);
  const [interval, setInterval] = useLocalState<"month" | "year">("rl-billing-interval", "month");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [billingOff, setBillingOff] = useState<string | null>(null);

  const list = plans.data ?? PLANS;
  const currentPlanId: PlanId = usage?.plan ?? "free";

  const checkout = async (plan: PlanId) => {
    setBusyPlan(plan);
    try {
      const { url } = await billing.checkout(projectId, plan, interval);
      window.location.assign(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setBillingOff("Billing isn't enabled yet for this deployment.");
      else toastError(e, "Couldn't start checkout");
      setBusyPlan(null);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const { url } = await billing.portal(projectId);
      window.location.assign(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setBillingOff("Billing isn't enabled yet for this deployment.");
      else toastError(e, "Couldn't open the billing portal");
      setPortalBusy(false);
    }
  };

  return (
    <div className="rl-stack" style={{ marginTop: 12 }}>
      {billingOff && (
        <Callout intent="warning" icon="credit-card" title="Billing isn't enabled yet">
          {billingOff} Self-hosted? Plans and usage still apply — checkout is unavailable until billing is configured.
        </Callout>
      )}

      <Card compact>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <H5 style={{ margin: 0 }}>
            Usage this period{" "}
            {usage && (
              <Tag minimal intent="primary" style={{ marginLeft: 6 }}>
                {list.find((p) => p.id === usage.plan)?.name ?? usage.plan}
              </Tag>
            )}
          </H5>
          <Button small minimal icon="credit-card" text="Manage billing" loading={portalBusy} onClick={() => void openPortal()} />
        </div>
        {usageLoading ? (
          <div className={Classes.SKELETON} style={{ height: 60, borderRadius: 6 }} />
        ) : usage ? (
          <>
            <UsageMeter label="Events" used={usage.events_used} limit={usage.events_limit} />
            <UsageMeter label="Seats" used={usage.seats_used} limit={usage.seats_limit} />
            <div className="rl-muted" style={{ fontSize: 12 }}>
              {new Date(usage.period_start).toLocaleDateString()} – {new Date(usage.period_end).toLocaleDateString()} ·{" "}
              {usage.retention_days}-day history
            </div>
          </>
        ) : (
          <Callout compact>Usage data is unavailable right now.</Callout>
        )}
      </Card>

      <Card compact>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <H5 style={{ margin: 0 }}>Plans</H5>
          <SegmentedControl
            size="small"
            value={interval}
            onValueChange={(v) => setInterval(v as "month" | "year")}
            options={[
              { label: "Monthly", value: "month" },
              { label: "Yearly (−17%)", value: "year" },
            ]}
          />
        </div>
        <div className="rl-plan-grid">
          {list.map((p) => {
            const isCurrent = p.id === currentPlanId;
            const price = interval === "month" ? p.price_month : p.price_year;
            const order = ["free", "starter", "growth", "scale"];
            const isUpgrade = order.indexOf(p.id) > order.indexOf(currentPlanId);
            return (
              <Card key={p.id} compact className="rl-plan-card" style={isCurrent ? { outline: "2px solid var(--bp-intent-primary-rest)" } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{p.name}</b>
                  {isCurrent && (
                    <Tag intent="primary" minimal>
                      Current
                    </Tag>
                  )}
                </div>
                <div className="rl-plan-price">
                  ${price}
                  <span className="rl-muted" style={{ fontSize: 13, fontWeight: 400 }}>
                    /{interval === "month" ? "mo" : "yr"}
                  </span>
                </div>
                <div className="rl-muted" style={{ fontSize: 12 }}>
                  {p.events_limit === -1 ? "Unlimited events" : `${fmtNum(p.events_limit)} events/mo`} ·{" "}
                  {p.seats_limit === -1 ? "unlimited seats" : `${p.seats_limit} seats`} · {p.retention_days}d history
                </div>
                <ul>
                  {p.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                <Button
                  intent={isCurrent ? "none" : "primary"}
                  icon={isCurrent ? "tick" : isUpgrade ? "arrow-up" : "swap-horizontal"}
                  text={isCurrent ? "Current plan" : isUpgrade ? "Upgrade" : "Switch"}
                  disabled={isCurrent}
                  loading={busyPlan === p.id}
                  onClick={() => void checkout(p.id)}
                />
              </Card>
            );
          })}
        </div>
        {!detail.company.billing && (
          <div className="rl-muted" style={{ fontSize: 12, marginTop: 12 }}>
            <Icon icon="info-sign" size={12} /> Hosted checkout may be unavailable on this deployment.
          </div>
        )}
      </Card>
    </div>
  );
}
