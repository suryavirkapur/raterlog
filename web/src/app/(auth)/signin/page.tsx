import { Form } from "@/lib/form";
import { Argon2id } from "oslo/password";
import { cookies } from "next/headers";
import { lucia } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";

// app/login/page.tsx
export default async function Page() {
  return (
    <div className="flex flex-row min-h-screen justify-center items-center bg-gray-50  dark:bg-gray-950">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Login to account</CardTitle>
        </CardHeader>
        <CardContent>
          <Form action={login}>
            <Label htmlFor="email">Email</Label>
            <Input type="email" name="email" id="email" />
            <Label htmlFor="password">Password</Label>
            <Input type="password" name="password" id="password" />
            <br />
            <Button>Login</Button>
          </Form>
        </CardContent>
      </Card>
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
