import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Button, Callout, NonIdealState, Spinner, Tag } from "@blueprintjs/core";
import { ApiError, auth, invites, type Invite as InviteType } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { toastError } from "@/lib/toaster";
import { AuthLayout } from "./AuthLayout";

export default function Invite() {
  const { token } = useParams({ strict: false }) as { token: string };
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const inviteReq = useAsync<InviteType>(() => invites.get(token), [token]);
  const meReq = useAsync(() => auth.me().catch(() => null), []);
  const invite = inviteReq.data;

  async function accept() {
    setBusy(true);
    try {
      await invites.accept(token);
      navigate({ to: "/app/$projectId", params: { projectId: invite!.companyID }, search: { q: undefined, event: undefined, tag: undefined } });
    } catch (e) {
      toastError(e, "Couldn't accept the invite");
      setBusy(false);
      inviteReq.reload();
    }
  }

  async function signOutToOtherAccount() {
    try {
      await auth.signout();
    } catch {}
    navigate({
      to: "/signin",
      search: { email: invite?.email ?? "", invite: token },
    });
  }

  if (inviteReq.loading || meReq.loading) {
    return (
      <AuthLayout title="Loading invite…">
        <div style={{ display: "grid", placeItems: "center", padding: "32px 0" }}>
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  const me = meReq.data ?? null; // null = signed out

  // Invalid / unknown token
  if (inviteReq.error || !invite) {
    const err = inviteReq.error;
    return (
      <AuthLayout title="Invite not found">
        <NonIdealState
          icon="link"
          title="This invite link doesn't work"
          description={
            err instanceof ApiError && err.status !== 404
              ? err.message
              : "It may have been revoked, or the link was copied incompletely. Ask the person who invited you to send a fresh one."
          }
          action={
            <Link to="/">
              <Button text="Go home" />
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  const projectName = invite.companyName || "a project";
  const expired = new Date(invite.expiresAt).getTime() < Date.now();

  if (invite.status === "accepted") {
    return (
      <AuthLayout title="Invite already used">
        <NonIdealState
          icon="tick-circle"
          title="This invite was already accepted"
          description="If that was you, sign in to open the project. Otherwise, ask for a new invite."
          action={
            <Link to="/signin" search={{ email: invite.email, invite: "" }}>
              <Button intent="primary" text="Sign in" />
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  if (expired) {
    return (
      <AuthLayout title="Invite expired">
        <NonIdealState
          icon="outdated"
          title="This invite has expired"
          description="Invite links are valid for a limited time. Ask the project owner to send a new one."
          action={
            <Link to="/">
              <Button text="Go home" />
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  // Signed out → point at signup / signin with the invite in search params.
  if (me === null) {
    return (
      <AuthLayout
        title={`Join ${projectName}`}
        subtitle={
          <>
            You've been invited to collaborate. Sign up or sign in as{" "}
            <strong>{invite.email}</strong> to accept.
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link to="/signup" search={{ email: invite.email, invite: token }}>
            <Button intent="primary" large fill text={`Create account as ${invite.email}`} />
          </Link>
          <Link to="/signin" search={{ email: invite.email, invite: token }}>
            <Button large fill outlined text="I already have an account" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Wrong account
  if (me.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <AuthLayout title="Wrong account">
        <Callout intent="warning" icon="warning-sign" style={{ marginBottom: 16 }}>
          This invite is for <strong>{invite.email}</strong>, but you're signed in as{" "}
          <strong>{me.email}</strong>.
        </Callout>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button
            intent="primary"
            large
            fill
            text={`Sign in as ${invite.email}`}
            onClick={signOutToOtherAccount}
          />
          <Link to="/app">
            <Button large fill minimal text="Stay signed in" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Ready to accept
  return (
    <AuthLayout
      title={`Join ${projectName}`}
      subtitle={
        <>
          Accepting as <Tag minimal>{me.email}</Tag>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button
          intent="primary"
          large
          fill
          icon="tick"
          text="Accept invite"
          loading={busy}
          onClick={accept}
        />
        <Link to="/app">
          <Button large fill minimal text="Not now" />
        </Link>
      </div>
    </AuthLayout>
  );
}
