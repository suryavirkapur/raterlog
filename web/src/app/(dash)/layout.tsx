import { lucia, validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { ActionResult, Form } from "@/lib/form";
import {
  Button,
  Container,
  Flex,
  Heading,
  Link,
  Text,
  Theme,
  Box,
  Separator,
  IconButton,
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
  if (!user) return redirect("/signin");

  const companyUsers = await db.companyUser.findMany({
    where: { userID: user.id },
    include: { company: true },
  });

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
          <Flex style={{ minHeight: "100vh" }}>
            {/* Sidebar */}
            <Box
              style={{
                width: "260px",
                borderRight: "1px solid var(--gray-a5)",
                padding: "20px",
                flexShrink: 0,
              }}
            >
              <Flex direction="column" gap="5" style={{ height: "100%" }}>
                <Flex align="center" justify="between">
                  <Heading size="5">Raterlog</Heading>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="1">
                  <Text size="1" weight="bold" color="gray" mb="2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Overview
                  </Text>
                  <Link
                    underline="none"
                    href="/dash"
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-3)",
                      color: "var(--gray-12)",
                    }}
                  >
                    <Text size="2">Home</Text>
                  </Link>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="1">
                  <Text size="1" weight="bold" color="gray" mb="2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Companies
                  </Text>
                  {companyUsers.map((cu) => (
                    <Link
                      underline="none"
                      href={`/dash/${cu.companyID}`}
                      key={cu.companyID}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--radius-3)",
                        color: "var(--gray-12)",
                      }}
                    >
                      <Text size="2">{cu.company.name}</Text>
                    </Link>
                  ))}
                  {companyUsers.length === 0 && (
                    <Text size="2" color="gray" style={{ padding: "8px 12px" }}>
                      No companies yet
                    </Text>
                  )}
                </Flex>

                <Box style={{ marginTop: "auto" }}>
                  <Separator size="4" mb="3" />
                  <Flex align="center" justify="between">
                    <Text size="2" color="gray">
                      {user.name}
                    </Text>
                    <Form action={logout}>
                      <Button type="submit" variant="soft" size="1">
                        Logout
                      </Button>
                    </Form>
                  </Flex>
                </Box>
              </Flex>
            </Box>

            {/* Main Content */}
            <Box style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
              <Container size="3">{children}</Container>
            </Box>
          </Flex>
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
