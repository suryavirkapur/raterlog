import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
} from "@radix-ui/themes";
import { acceptInvite, getInvite } from "@/server/data";
import AuthShell from "@/components/AuthShell";

export const Route = createFileRoute("/invite/$token")({
  loader: async ({ params }) =>
    await getInvite({ data: { token: params.token } }),
  component: InvitePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        {children}
      </Card>
    </AuthShell>
  );
}

function InvitePage() {
  const { invite, user } = Route.useLoaderData();
  const { token } = Route.useParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!invite) {
    return (
      <Shell>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invalid Invite</Heading>
          <Text color="gray" align="center">
            This invitation link is invalid or has been removed.
          </Text>
          <Button asChild variant="soft">
            <Link to="/">Go home</Link>
          </Button>
        </Flex>
      </Shell>
    );
  }

  if (invite.status !== "pending") {
    return (
      <Shell>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invite Already Used</Heading>
          <Text color="gray" align="center">
            This invitation has already been accepted.
          </Text>
          <Button asChild>
            <Link to="/dash">Go to Dashboard</Link>
          </Button>
        </Flex>
      </Shell>
    );
  }

  if (new Date() > new Date(invite.expiresAt)) {
    return (
      <Shell>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invite Expired</Heading>
          <Text color="gray" align="center">
            This invitation to <strong>{invite.companyName}</strong> has expired.
            Ask the team admin to send a new one.
          </Text>
          <Button asChild variant="soft">
            <Link to="/">Go home</Link>
          </Button>
        </Flex>
      </Shell>
    );
  }

  if (user) {
    if (user.email === invite.email) {
      async function onAccept() {
        setPending(true);
        setError(null);
        const res = await acceptInvite({ data: { token } });
        setPending(false);
        if (res?.error) setError(res.error);
        else if (res?.redirect) window.location.assign(res.redirect);
      }
      return (
        <Shell>
          <Flex direction="column" gap="4" align="center">
            <Badge size="2" variant="soft">
              Team Invitation
            </Badge>
            <Heading size="5" align="center">
              Join {invite.companyName}
            </Heading>
            <Text color="gray" align="center" size="2">
              You ({user.email}) have been invited to join{" "}
              <strong>{invite.companyName}</strong> on Raterlog.
            </Text>
            {error && (
              <Callout.Root color="red" size="1">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}
            <Button
              size="3"
              style={{ width: "100%" }}
              loading={pending}
              onClick={onAccept}
            >
              Accept &amp; Join
            </Button>
          </Flex>
        </Shell>
      );
    }

    return (
      <Shell>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Wrong Account</Heading>
          <Text color="gray" align="center" size="2">
            This invite was sent to <strong>{invite.email}</strong> but you&apos;re
            logged in as <strong>{user.email}</strong>.
          </Text>
          <Separator size="4" />
          <Text size="2" color="gray">
            Log out and sign in with the invited email, or create a new account.
          </Text>
        </Flex>
      </Shell>
    );
  }

  return (
    <Shell>
      <Flex direction="column" gap="4" align="center">
        <Badge size="2" variant="soft">
          Team Invitation
        </Badge>
        <Heading size="5" align="center">
          Join {invite.companyName}
        </Heading>
        <Text color="gray" align="center" size="2">
          You&apos;ve been invited to join <strong>{invite.companyName}</strong> on
          Raterlog. Sign in or create an account to accept.
        </Text>
        <Text size="1" color="gray">
          Invited: {invite.email}
        </Text>
        <Separator size="4" />
        <Flex direction="column" gap="3" style={{ width: "100%" }}>
          <Button size="3" asChild style={{ width: "100%" }}>
            <Link
              to="/signup"
              search={{ email: invite.email, invite: token }}
            >
              Create account
            </Link>
          </Button>
          <Button size="3" variant="outline" asChild style={{ width: "100%" }}>
            <Link to="/signin" search={{ email: invite.email, invite: token }}>
              Sign in
            </Link>
          </Button>
        </Flex>
      </Flex>
    </Shell>
  );
}
