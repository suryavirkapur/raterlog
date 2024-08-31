import db from "@/lib/db";
import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ActionResult, Form } from "@/lib/form";
import Link from "next/link";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";
import { Box, Button, Flex, Heading } from "@radix-ui/themes";

export default async function Page() {
  const { user } = await validateRequest();
  const companies = await db.companyUser.findMany({
    where: { userID: user?.id },
  });
  if (!user) return;
  return (
    <div className="">
      <Flex className="">
        <Box>
          <Heading>Choose an Organization</Heading>
          <h1>Hi, {user.name}!</h1>
        </Box>
        <Box>
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
        </Box>
        <Box>
          <form action={makeCompany}>
            <label htmlFor="name">Name</label>
            <input name="name" id="name" />
            <Button type="submit">Add Company</Button>
          </form>
          <Form action={logout}>
            <Button>Logout</Button>
          </Form>
        </Box>
      </Flex>
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
  await db.companyUser.create({
    data: {
      userID: user.id,
      companyID: company.id,
    },
  });

  console.log(company.name);
  revalidatePath(`/dash`);
  return { error: "" };
}
