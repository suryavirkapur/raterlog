import db from "@/lib/db";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { generateId } from "lucia";
import { Form } from "@/lib/form";
import { Flex, Box, Button, Heading } from "@radix-ui/themes";

export default async function Page() {
  const { user } = await validateRequest();
  if (user) {
    return redirect("/dash");
  }
  return (
    <div className="flex flex-row min-h-screen justify-center items-center bg-gray-50 dark:bg-gray-950">
      <Flex className="w-[400px]">
        <Box>
          <Heading>Create an account</Heading>
        </Box>
        <Flex>
          <form action={signup}>
            <label htmlFor="name">Name</label>
            <input name="name" id="name" />
            <br />
            <label htmlFor="email">Email</label>
            <input type="email" name="email" id="email" />
            <br />
            <label htmlFor="password">Password</label>
            <input type="password" name="password" id="password" />
            <br />
            <Button>Register</Button>
          </form>
        </Flex>
      </Flex>
    </div>
  );
}

async function signup(formData: FormData): Promise<ActionResult> {
  "use server";
  const name = formData.get("name");
  // username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
  // keep in mind some database (e.g. mysql) are case insensitive
  if (typeof name !== "string" || name.length < 3 || name.length > 31) {
    return {
      error: "Invalid name",
    };
  }
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
  if (existingUser) {
    return {
      error: "Email exists!",
    };
  }

  const hashedPassword = await new Argon2id().hash(password);
  const userId = generateId(15);

  // TODO: check if username is already used
  await db.user.create({
    data: {
      id: userId,
      name: name,
      email: email,
      password: hashedPassword,
    },
  });

  const session = await lucia.createSession(userId, {});
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
