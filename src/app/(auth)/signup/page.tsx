import db from "@/lib/db";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia } from "@/lib/auth";
import { redirect } from "next/navigation";
import { generateId } from "lucia";
import { Form } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";

export default async function Page() {
  return (
    <div className="flex flex-row min-h-screen justify-center items-center bg-gray-50 dark:bg-gray-950">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signup}>
            <Label htmlFor="name">Name</Label>
            <Input name="name" id="name" />
            <Label htmlFor="email">Email</Label>
            <Input type="email" name="email" id="email" />
            <Label htmlFor="password">Password</Label>
            <Input type="password" name="password" id="password" />
            <br />
            <Button>Register</Button>
          </form>
        </CardContent>
      </Card>
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
