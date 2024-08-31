import { Form } from "@/lib/form";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { Box, Button, Flex, Heading } from "@radix-ui/themes";

// app/login/page.tsx
export default async function Page() {
  const { user } = await validateRequest();
  if (user) {
    return redirect("/dash");
  }
  return (
    <div className="flex flex-row min-h-screen justify-center items-center bg-gray-50  dark:bg-gray-950">
      <Flex className="w-[400px]">
        <Box>
          <Heading>Login to account</Heading>
        </Box>
        <Box>
          <Form action={login}>
            <label htmlFor="email">Email</label>
            <input type="email" name="email" id="email" />
            <br />
            <label htmlFor="password">Password</label>
            <input type="password" name="password" id="password" />
            <br />
            <br />
            <Button>Login</Button>
          </Form>
        </Box>
      </Flex>
    </div>
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
