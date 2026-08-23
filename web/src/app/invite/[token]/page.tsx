"use client";

import { api, apiOptional, type Invite } from "@/lib/api";
import { ActionResult, Form } from "@/lib/form";
import {
  Button,
  Card,
  Flex,
  Heading,
  Text,
  Badge,
  Separator,
} from "@radix-ui/themes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    apiOptional<Invite>(`/api/invites/${params.token}`).then(setInvite);
    apiOptional<{ email: string }>("/api/auth/me").then((me) =>
      setEmail(me?.email ?? null)
    );
  }, [params.token]);

  if (invite === undefined) return null;

  if (!invite) {
    return (
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invalid Invite</Heading>
          <Text color="gray" align="center">
            This invitation link is invalid or has been removed.
          </Text>
          <Button asChild variant="soft">
            <Link href="/">Go home</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  if (invite.status !== "pending") {
    return (
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invite Already Used</Heading>
          <Text color="gray" align="center">
            This invitation has already been accepted.
          </Text>
          <Button asChild>
            <Link href="/dash">Go to Dashboard</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return (
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invite Expired</Heading>
          <Text color="gray" align="center">
            This invitation to <strong>{invite.companyName}</strong> has expired.
            Ask the team admin to send a new one.
          </Text>
          <Button asChild variant="soft">
            <Link href="/">Go home</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  async function accept(): Promise<ActionResult> {
    try {
      await api(`/api/invites/${params.token}/accept`, {
        method: "POST",
        body: "{}",
      });
      router.push(`/dash/${invite!.companyID}`);
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Accept failed" };
    }
  }

  if (email) {
    if (email === invite.email) {
      return (
        <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
          <Flex direction="column" gap="4" align="center">
            <Badge size="2" variant="soft">
              Team Invitation
            </Badge>
            <Heading size="5" align="center">
              Join {invite.companyName}
            </Heading>
            <Text color="gray" align="center" size="2">
              You ({email}) have been invited to join{" "}
              <strong>{invite.companyName}</strong> on Raterlog.
            </Text>
            <Form action={accept}>
              <Button type="submit" size="3" style={{ width: "100%" }}>
                Accept &amp; Join
              </Button>
            </Form>
          </Flex>
        </Card>
      );
    }
    return (
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Wrong Account</Heading>
          <Text color="gray" align="center" size="2">
            This invite was sent to <strong>{invite.email}</strong> but
            you&apos;re logged in as <strong>{email}</strong>.
          </Text>
          <Separator size="4" />
          <Text size="2" color="gray">
            Log out and sign in with the invited email, or create a new account.
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
      <Flex direction="column" gap="4" align="center">
        <Badge size="2" variant="soft">
          Team Invitation
        </Badge>
        <Heading size="5" align="center">
          Join {invite.companyName}
        </Heading>
        <Text color="gray" align="center" size="2">
          You&apos;ve been invited to join <strong>{invite.companyName}</strong>{" "}
          on Raterlog. Sign in or create an account to accept.
        </Text>
        <Text size="1" color="gray">
          Invited: {invite.email}
        </Text>
        <Separator size="4" />
        <Flex direction="column" gap="3" style={{ width: "100%" }}>
          <Button size="3" asChild style={{ width: "100%" }}>
            <Link
              href={`/signup?email=${encodeURIComponent(invite.email)}&invite=${params.token}`}
            >
              Create account
            </Link>
          </Button>
          <Button size="3" variant="outline" asChild style={{ width: "100%" }}>
            <Link
              href={`/signin?email=${encodeURIComponent(invite.email)}&invite=${params.token}`}
            >
              Sign in
            </Link>
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}
