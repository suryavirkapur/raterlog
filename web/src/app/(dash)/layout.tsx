import { lucia, validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { ActionResult, Form } from "@/lib/form";
import {
  Button,
  Container,
  Flex,
  Heading,
  Link,
  Theme,
} from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Raterlog",
  description: "Raterlog's Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await validateRequest();
  const companies = await db.companyUser.findMany({
    where: { userID: user?.id },
  });
  if (!user) return;
  return (
    <html lang="en">
      <body>
        <Theme
          accentColor="blue"
          grayColor="sand"
          radius="large"
          scaling="95%"
          appearance="dark"
        >
          <Container p="2">
            <Flex justify="between">
              <Heading>Raterlog</Heading>
              <Form action={logout}>
                <Button type="submit">Logout</Button>
              </Form>
            </Flex>
            <Flex direction="row">
              <Flex width={"25%"} direction="column">
                <Heading size="4">Settings</Heading>
                <Heading size="3">
                  <Link underline="none" href="/dash">
                    Home
                  </Link>
                </Heading>
                <br />
                <Heading size="4">Companies</Heading>
                {companies.map(async (company) => {
                  const res = await db.company.findFirst({
                    where: { id: company.companyID },
                  });
                  return (
                    <>
                      <Heading size="3" key={company.companyID}>
                        <Link
                          underline="none"
                          href={`/dash/${company.companyID}`}
                        >
                          {res?.name}
                        </Link>
                      </Heading>
                    </>
                  );
                })}
              </Flex>
              <Flex>
                <main>{children}</main>
              </Flex>
            </Flex>
          </Container>
        </Theme>
      </body>
    </html>
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
  return redirect("/");
}
