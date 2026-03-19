import db from "@/lib/db";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { generateId } from "lucia";
import { Form } from "@/lib/form";
import { Flex, Box, Button, Heading, Text, Card, TextField, Callout } from "@radix-ui/themes";
import Link from "next/link";

export default async function Page({
  searchParams,
}: {
  searchParams: { email?: string; invite?: string };
}) {
  const { user } = await validateRequest();
  if (user) {
    if (searchParams.invite) {
      return redirect(`/invite/${searchParams.invite}`);
    }
    return redirect("/dash");
  }

  const inviteEmail = searchParams.email || "";
  const inviteToken = searchParams.invite || "";

  return (
    <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
      <Flex direction="column" gap="5">
        <Box>
          <Heading size="6" mb="1">Create an account</Heading>
          <Text size="2" color="gray">Enter your details to get started</Text>
        </Box>
        {inviteToken && (
          <Callout.Root color="blue" size="1">
            <Callout.Text>You&apos;ve been invited to join a team. Create an account to accept.</Callout.Text>
          </Callout.Root>
        )}
        <Form action={signup}>
          <input type="hidden" name="inviteToken" value={inviteToken} />
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="medium">Name</Text>
              <TextField.Root name="name" placeholder="Your name" size="3" />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="medium">Email</Text>
              <TextField.Root
                type="email"
                name="email"
                placeholder="you@example.com"
                size="3"
                defaultValue={inviteEmail}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="medium">Password</Text>
              <TextField.Root type="password" name="password" placeholder="Min 6 characters" size="3" />
            </label>
            <Button type="submit" size="3" mt="1">Create account</Button>
          </Flex>
        </Form>
        <Text size="2" align="center" color="gray">
          Already have an account?{" "}
          <Link href={`/signin${inviteToken ? `?email=${encodeURIComponent(inviteEmail)}&invite=${inviteToken}` : ""}`} style={{ color: "var(--accent-9)" }}>
            Sign in
          </Link>
        </Text>
      </Flex>
    </Card>
  );
}

async function signup(_: any, formData: FormData): Promise<ActionResult> {
  "use server";
  const name = formData.get("name");
  if (typeof name !== "string" || name.length < 3 || name.length > 31) {
    return { error: "Invalid name" };
  }
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 6 || password.length > 255) {
    return { error: "Invalid password" };
  }
  const email = formData.get("email");
  if (
    typeof email !== "string" ||
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email)
  ) {
    return { error: "Invalid email" };
  }

  const existingUser = await db.user.findFirst({ where: { email } });
  if (existingUser) {
    return { error: "Email exists!" };
  }

  const hashedPassword = await new Argon2id().hash(password);
  const userId = generateId(15);

  await db.user.create({
    data: { id: userId, name, email, password: hashedPassword },
  });

  // Accept invite if present
  const inviteToken = formData.get("inviteToken");
  if (typeof inviteToken === "string" && inviteToken.length > 0) {
    const invite = await db.invite.findUnique({ where: { token: inviteToken } });
    if (invite && invite.status === "pending" && new Date() < invite.expiresAt && invite.email === email) {
      await db.companyUser.create({
        data: { companyID: invite.companyID, userID: userId },
      });
      await db.invite.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      });
    }
  }

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  if (typeof inviteToken === "string" && inviteToken.length > 0) {
    const invite = await db.invite.findUnique({ where: { token: inviteToken } });
    if (invite) return redirect(`/dash/${invite.companyID}`);
  }
  return redirect("/dash");
}

interface ActionResult {
  error: string;
}
