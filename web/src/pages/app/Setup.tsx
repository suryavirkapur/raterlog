import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  Callout,
  Card,
  FormGroup,
  InputGroup,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import { events, projects, type Token } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useProject } from "@/lib/context";
import { toast, toastError } from "@/lib/toaster";
import { CodeBlock } from "@/components/marketing/CodeBlock";
import { CodeTabs } from "@/components/marketing/CodeTabs";
import "@/components/marketing/marketing.css";

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Tag round minimal intent={done ? "success" : "none"} icon={done ? "tick" : undefined}>
          {done ? "Done" : `Step ${n}`}
        </Tag>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      </div>
      {children}
    </Card>
  );
}

export default function Setup() {
  const { detail, reload } = useProject();
  const projectId = detail.company.id;
  const projectName = detail.company.name;
  const base = location.origin;

  const [createdToken, setCreatedToken] = useState<Token | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  // A usable token value for snippets: prefer the one created this session
  // (guaranteed unmasked), else the first listed token.
  const tokenValue = createdToken?.token ?? detail.tokens[0]?.token ?? "<api-token>";

  // Poll for the first event every 3s until one exists.
  const { data: first } = useAsync(
    () => events.list(projectId, { limit: 1 }).catch(() => []),
    [projectId],
    { pollMs: 3000 },
  );
  const hasEvent = (first?.length ?? 0) > 0;
  const [celebrated, setCelebrated] = useState(false);
  useEffect(() => {
    if (hasEvent && !celebrated) {
      setCelebrated(true);
      toast({ message: "First event received 🎉", intent: "success", icon: "tick-circle" });
    }
  }, [hasEvent, celebrated]);

  async function createToken() {
    setTokenBusy(true);
    try {
      const t = await projects.createToken(projectId, "default");
      setCreatedToken(t);
      toast({ message: "API token created", intent: "success", icon: "key" });
      reload();
    } catch (e) {
      toastError(e, "Couldn't create token");
    } finally {
      setTokenBusy(false);
    }
  }

  async function sendTestEvent() {
    setSendBusy(true);
    setSendResult(null);
    try {
      const res = await fetch(`${base}/v1/log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenValue}`,
        },
        body: JSON.stringify({
          project: projectName,
          channel: "getting-started",
          event: "Hello Raterlog",
          description: "Sent from the setup guide",
          icon: "🎉",
          notify: false,
          tags: { source: "setup" },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setSendResult("ok");
      toast({ message: "Test event sent", intent: "success", icon: "send-message" });
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : "Send failed");
      toastError(e, "Couldn't send the test event");
    } finally {
      setSendBusy(false);
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ message: "Enter a valid email", intent: "warning" });
      return;
    }
    setInviteBusy(true);
    try {
      const inv = await projects.invite(projectId, email);
      setInviteLink(`${location.origin}/invite/${inv.token}`);
      toast({ message: `Invite created for ${email}`, intent: "success", icon: "envelope" });
      setInviteEmail("");
      reload();
    } catch (e) {
      toastError(e, "Couldn't create invite");
    } finally {
      setInviteBusy(false);
    }
  }

  const canSend = tokenValue !== "<api-token>";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Set up {projectName}</h1>
      <p style={{ opacity: 0.7, fontSize: 14, margin: "0 0 24px" }}>
        Five quick steps and your project is live.
      </p>

      <Step n={1} title="Create an API token" done={detail.tokens.length > 0}>
        {detail.tokens.length > 0 ? (
          <p style={{ fontSize: 13.5, opacity: 0.75, margin: "0 0 10px" }}>
            You have {detail.tokens.length} token{detail.tokens.length > 1 ? "s" : ""}. Manage them
            in Settings → API tokens.
          </p>
        ) : (
          <p style={{ fontSize: 13.5, opacity: 0.75, margin: "0 0 10px" }}>
            Your server authenticates with a Bearer token. Create one now — you can add more later.
          </p>
        )}
        <Button
          icon="key"
          intent={detail.tokens.length ? "none" : "primary"}
          text={detail.tokens.length ? "Create another token" : "Create token"}
          loading={tokenBusy}
          onClick={createToken}
        />
        {createdToken && (
          <div style={{ marginTop: 12 }}>
            <Callout intent="success" icon="tick" style={{ marginBottom: 10 }}>
              Save this token somewhere safe — it won't be shown in full again.
            </Callout>
            <CodeBlock label="api token" code={createdToken.token} />
          </div>
        )}
      </Step>

      <Step n={2} title="Send your first event" done={hasEvent}>
        <p style={{ fontSize: 13.5, opacity: 0.75, margin: "0 0 10px" }}>
          One POST to <code>/v1/log</code>. The <code>getting-started</code> channel is created
          automatically.
        </p>
        <CodeTabs
          tabs={[
            {
              id: "curl",
              label: "curl",
              code: `curl -X POST ${base}/v1/log \\
  -H "Authorization: Bearer ${tokenValue}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project": "${projectName}",
    "channel": "getting-started",
    "event": "Hello Raterlog",
    "icon": "🎉",
    "notify": false
  }'`,
            },
            {
              id: "js",
              label: "JavaScript",
              code: `await fetch("${base}/v1/log", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${tokenValue}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    project: "${projectName}",
    channel: "getting-started",
    event: "Hello Raterlog",
    icon: "🎉",
    notify: false,
  }),
});`,
            },
          ]}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <Button
            icon="send-message"
            text="Send test event"
            loading={sendBusy}
            disabled={!canSend}
            onClick={sendTestEvent}
          />
          {!canSend && (
            <span style={{ fontSize: 12.5, opacity: 0.65 }}>Create a token first (step 1).</span>
          )}
          {sendResult === "ok" && (
            <Tag intent="success" minimal icon="tick">
              sent
            </Tag>
          )}
        </div>
      </Step>

      <Step n={3} title="Watch it arrive" done={hasEvent}>
        {hasEvent ? (
          <Callout intent="success" icon="tick-circle">
            <strong>Your first event is in.</strong> This is what Raterlog does — everything from
            here on out is just more of it.
            <div style={{ marginTop: 8 }}>
              <Link to="/app/$projectId" params={{ projectId }} search={{ q: undefined, event: undefined, tag: undefined }}>
                <Button small intent="success" text="Open the live feed" rightIcon="arrow-right" />
              </Link>
            </div>
          </Callout>
        ) : (
          <Callout icon="satellite">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Spinner size={14} /> Waiting for your first event… Send the test event above, or POST
              from your own code.
            </span>
          </Callout>
        )}
      </Step>

      <Step
        n={4}
        title="Invite a teammate"
        done={detail.members.length > 1 || detail.invites.length > 0}
      >
        <p style={{ fontSize: 13.5, opacity: 0.75, margin: "0 0 10px" }}>
          Events are better shared. Invite someone to this project.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendInvite();
          }}
          style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <FormGroup label="Email" labelFor="rl-invite-email" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
            <InputGroup
              id="rl-invite-email"
              type="email"
              leftIcon="envelope"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              fill
            />
          </FormGroup>
          <Button type="submit" icon="send-message" text="Send invite" loading={inviteBusy} />
        </form>
        {inviteLink && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 6px" }}>
              Share this link — it works once, for that email only:
            </p>
            <CodeBlock label="invite link" code={inviteLink} />
          </div>
        )}
      </Step>

      <Step n={5} title="Enable notifications" done={perm === "granted"}>
        {perm === "unsupported" ? (
          <Callout icon="info-sign">This browser doesn't support notifications — skip this one.</Callout>
        ) : perm === "granted" ? (
          <Callout intent="success" icon="notifications">
            Notifications are on. Events sent with <code>notify: true</code> will ping this browser.
          </Callout>
        ) : perm === "denied" ? (
          <Callout intent="warning" icon="notifications-snooze">
            Notifications are blocked for this site. Enable them in your browser's site settings to
            get event alerts.
          </Callout>
        ) : (
          <>
            <p style={{ fontSize: 13.5, opacity: 0.75, margin: "0 0 10px" }}>
              Get pinged when events arrive with <code>notify: true</code>.
            </p>
            <Button
              icon="notifications"
              text="Enable browser notifications"
              onClick={async () => {
                try {
                  setPerm(await Notification.requestPermission());
                } catch (e) {
                  toastError(e);
                }
              }}
            />
          </>
        )}
      </Step>
    </div>
  );
}
