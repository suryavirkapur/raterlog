import db from "@/lib/db";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ActionResult, Form } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";

export default async function Page() {
  return (
    <div className="flex flex-row min-h-screen justify-center items-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <h1>Hi, {}!</h1>
        </CardHeader>
        <CardContent>
          <Form action={logout}>
            <Button>Logout</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

async function logout(): Promise<ActionResult> {
  "use server";
  const { session } = await validateRequest();
  if (!session) {
    return {
      error: "Unauthorized",
    };
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
  return redirect("/signin");
}
