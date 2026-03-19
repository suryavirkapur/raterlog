import { Form } from "@/lib/form";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { Box, Button, Flex, Heading, Text, Card, TextField } from "@radix-ui/themes";
import Link from "next/link";

export default async function Page() {
  const { user } = await validateRequest();
  if (user) {
    return redirect("/dash");
  }
  return (
    <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
      <Flex direction="column" gap="5">
        <Box>
          <Heading size="6" mb="1">Welcome back</Heading>
          <Text size="2" color="gray">Sign in to your account</Text>
        </Box>
        <Form action={login}>
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Email
              </Text>
              <TextField.Root
                type="email"
                name="email"
                placeholder="you@example.com"
                size="3"
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Password
              </Text>
              <TextField.Root
                type="password"
                name="password"
                placeholder="Your password"
                size="3"
              />
            </label>
            <Button type="submit" size="3" mt="1">
              Sign in
            </Button>
          </Flex>
        </Form>
        <Text size="2" align="center" color="gray">
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--accent-9)" }}>
            Sign up
          </Link>
        </Text>
      </Flex>
    </Card>
  );
}
async function login(_: any, formData: FormData): Promise<ActionResult> {
  "use server";

  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 255
  ) {
    return {
      error: "Invalid password",
    };
  }

  const email = formData.get("email");
  if (
    typeof email !== "string" ||
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(
      email
    )
  ) {
    return {
      error: "Invalid email",
    };
  }

  const existingUser = await db.user.findFirst({
    where: {
      email,
    },
  });
  if (!existingUser) {
    return {
      error: "Incorrect username or password",
    };
  }

  const validPassword = await new Argon2id().verify(
    existingUser.password,
    password
  );
  if (!validPassword) {
    return {
      error: "Incorrect username or password",
    };
  }

  const session = await lucia.createSession(existingUser.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
  return redirect("/dash");
}

interface ActionResult {
  error: string;
}
