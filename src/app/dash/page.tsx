import db from "@/lib/db";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ActionResult, Form } from "@/lib/form";
import Link from "next/link";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardTitle,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default async function Page() {
  const { user } = await validateRequest();
  const x = await db.car.count();
  console.log(x);
  const companies = await db.companyUser.findMany({
    where: { userID: user?.id },
  });
  if (!user) return;
  return (
    <div className="flex flex-row min-h-screen justify-center items-center bg-gray-50  dark:bg-gray-950">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Choose an Organization</CardTitle>
          <h1>Hi, {user.name}!</h1>
        </CardHeader>
        <CardContent>
          {companies.map(async (company) => {
            const res = await db.company.findFirst({
              where: { id: company.companyID },
            });
            return (
              <>
                <Link
                  key={company.companyID}
                  href={`/dash/${company.companyID}`}
                >
                  {res?.name}
                </Link>
                <br />
              </>
            );
          })}
        </CardContent>
        <CardFooter>
          <form action={makeCompany}>
            <Label htmlFor="name">Name</Label>
            <Input name="name" id="name" />
            <Button type="submit">Add Company</Button>
          </form>
          <Form action={logout}>
            <Button>Logout</Button>
          </Form>
        </CardFooter>
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

async function makeCompany(formData: FormData): Promise<ActionResult> {
  "use server";
  const name = formData.get("name");

  if (typeof name !== "string" || name.trim() === "")
    return { error: "Company name is missing." };
  const { user } = await validateRequest();
  if (!user) return { error: "Company name is missing." };
  const companyID = generateId(15);
  const company = await db.company.create({
    data: {
      name: name,
      id: companyID,
      billing: false,
    },
  });
  revalidatePath("/dash");
  return { error: "" };
}
