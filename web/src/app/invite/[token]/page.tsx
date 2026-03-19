import db from "@/lib/db";
import { validateRequest } from "@/lib/auth";
import { ActionResult, Form } from "@/lib/form";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  Badge,
  Separator,
} from "@radix-ui/themes";
import Link from "next/link";

export default async function Page({ params }: { params: { token: string } }) {
  const invite = await db.invite.findUnique({
    where: { token: params.token },
    include: { company: true },
  });

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

  if (new Date() > invite.expiresAt) {
    return (
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Invite Expired</Heading>
          <Text color="gray" align="center">
            This invitation to <strong>{invite.company.name}</strong> has expired.
            Ask the team admin to send a new one.
          </Text>
          <Button asChild variant="soft">
            <Link href="/">Go home</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  const { user } = await validateRequest();

  // Logged in - check email match and accept
  if (user) {
    const acceptInvite = async (): Promise<ActionResult> => {
      "use server";
      const { user: currentUser } = await validateRequest();
      if (!currentUser) return { error: "Unauthorized" };

      // Re-fetch invite to check status
      const freshInvite = await db.invite.findUnique({
        where: { token: params.token },
      });
      if (!freshInvite || freshInvite.status !== "pending")
        return { error: "Invite no longer valid" };

      // Check if already a member
      const existing = await db.companyUser.findFirst({
        where: { companyID: freshInvite.companyID, userID: currentUser.id },
      });
      if (existing) {
        await db.invite.update({
          where: { id: freshInvite.id },
          data: { status: "accepted" },
        });
        return { error: "" };
      }

      // Add user to company
      await db.companyUser.create({
        data: {
          companyID: freshInvite.companyID,
          userID: currentUser.id,
        },
      });

      // Mark invite as accepted
      await db.invite.update({
        where: { id: freshInvite.id },
        data: { status: "accepted" },
      });

      revalidatePath(`/dash/${freshInvite.companyID}`);
      return { error: "" };
    };

    // Auto-accept if email matches
    if (user.email === invite.email) {
      return (
        <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
          <Flex direction="column" gap="4" align="center">
            <Badge size="2" variant="soft">Team Invitation</Badge>
            <Heading size="5" align="center">
              Join {invite.company.name}
            </Heading>
            <Text color="gray" align="center" size="2">
              You ({user.email}) have been invited to join{" "}
              <strong>{invite.company.name}</strong> on Raterlog.
            </Text>
            <Form action={acceptInvite}>
              <Button type="submit" size="3" style={{ width: "100%" }}>
                Accept &amp; Join
              </Button>
            </Form>
          </Flex>
        </Card>
      );
    }

    // Email mismatch
    return (
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="4" align="center">
          <Heading size="5">Wrong Account</Heading>
          <Text color="gray" align="center" size="2">
            This invite was sent to <strong>{invite.email}</strong> but
            you&apos;re logged in as <strong>{user.email}</strong>.
          </Text>
          <Separator size="4" />
          <Text size="2" color="gray">
            Log out and sign in with the invited email, or create a new account.
          </Text>
        </Flex>
      </Card>
    );
  }

  // Not logged in - show sign up / log in options
  return (
    <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
      <Flex direction="column" gap="4" align="center">
        <Badge size="2" variant="soft">Team Invitation</Badge>
        <Heading size="5" align="center">
          Join {invite.company.name}
        </Heading>
        <Text color="gray" align="center" size="2">
          You&apos;ve been invited to join{" "}
          <strong>{invite.company.name}</strong> on Raterlog.
          Sign in or create an account to accept.
        </Text>
        <Text size="1" color="gray">
          Invited: {invite.email}
        </Text>
        <Separator size="4" />
        <Flex direction="column" gap="3" style={{ width: "100%" }}>
          <Button size="3" asChild style={{ width: "100%" }}>
            <Link href={`/signup?email=${encodeURIComponent(invite.email)}&invite=${params.token}`}>
              Create account
            </Link>
          </Button>
          <Button size="3" variant="outline" asChild style={{ width: "100%" }}>
            <Link href={`/signin?email=${encodeURIComponent(invite.email)}&invite=${params.token}`}>
              Sign in
            </Link>
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}
