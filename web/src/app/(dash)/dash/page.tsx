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
      <Box>
        <Box>
          <h1>Hi, {user.name}!</h1>
        </Box>
        <br />

        <Flex
          style={{
            margin: 2,
            padding: 4,
            borderRadius: "5px",
            backgroundColor: "gray",
          }}
          direction="column"
        >
          <form action={makeCompany}>
            <label htmlFor="name">Name</label>
            <br />
            <input name="name" id="name" />
            <br />
            <Button type="submit">Add Company</Button>
          </form>
        </Flex>
      </Box>
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
