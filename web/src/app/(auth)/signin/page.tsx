import { Form } from "@/lib/form";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";

// app/login/page.tsx
export default async function Page() {
  const { user } = await validateRequest();
  if (user) {
    return redirect("/dash");
  }
  return (
    <Flex direction="column" gap="4">
      <Box>
        <Heading size="2" weight="bold">
          Login to account
        </Heading>
      </Box>
      <Box>
        <Form action={login}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Email
              </Text>
              <input
                type="email"
                name="email"
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--gray-6)",
                }}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Password
              </Text>
              <input
                type="password"
                name="password"
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--gray-6)",
                }}
              />
            </label>
            <Button type="submit" size="3">
              Login
            </Button>
          </Flex>
        </Form>
      </Box>
    </Flex>
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
