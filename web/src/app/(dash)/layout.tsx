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
} from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { cookies, headers } from "next/headers";
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

  // Detect active company from URL
  const pathname = headers().get("x-pathname") || headers().get("next-url") || "";
  let activeCompanyId: string | null = null;
  for (const cu of companyUsers) {
    if (pathname.includes(`/dash/${cu.companyID}`)) {
      activeCompanyId = cu.companyID;
      break;
    }
  }

  // Fetch channels for active company for sidebar
  let activeChannels: { id: string; name: string; icon: string }[] = [];
  if (activeCompanyId) {
    const activeCompany = await db.company.findFirst({
      where: { id: activeCompanyId },
      include: { Channel: true },
    });
    activeChannels = activeCompany?.Channel || [];
  }

  const sidebarLinkStyle = (isActive: boolean) => ({
    padding: "7px 12px",
    borderRadius: "var(--radius-3)",
    color: isActive ? "var(--accent-9)" : "var(--gray-11)",
    background: isActive ? "var(--accent-a3)" : "transparent",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: isActive ? 600 : 400,
    transition: "background 0.15s",
    display: "block",
  });

  const subLinkStyle = (isActive: boolean) => ({
    padding: "5px 12px 5px 24px",
    borderRadius: "var(--radius-3)",
    color: isActive ? "var(--accent-9)" : "var(--gray-10)",
    background: isActive ? "var(--accent-a3)" : "transparent",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: isActive ? 600 : 400,
    transition: "background 0.15s",
    display: "block",
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
                width: "240px",
                borderRight: "1px solid var(--gray-a5)",
                padding: "16px 12px",
                flexShrink: 0,
                overflowY: "auto",
              }}
            >
              <Flex direction="column" gap="4" style={{ height: "100%" }}>
                {/* Logo */}
                <Box px="2">
                  <Heading size="4" style={{ letterSpacing: "-0.02em" }}>Raterlog</Heading>
                </Box>

                <Separator size="4" />

                {/* Home */}
                <Flex direction="column" gap="1">
                  <Text size="1" weight="bold" color="gray" mb="1"
                    style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "10px", padding: "0 8px" }}>
                    Overview
                  </Text>
                  <Link underline="none" href="/dash"
                    style={sidebarLinkStyle(!activeCompanyId)}>
                    Home
                  </Link>
                </Flex>

                <Separator size="4" />

                {/* Companies */}
                <Flex direction="column" gap="1">
                  <Text size="1" weight="bold" color="gray" mb="1"
                    style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "10px", padding: "0 8px" }}>
                    Companies
                  </Text>
                  {companyUsers.map((cu) => {
                    const isActive = activeCompanyId === cu.companyID;
                    return (
                      <Flex direction="column" gap="0" key={cu.companyID}>
                        <Link underline="none" href={`/dash/${cu.companyID}`}
                          style={sidebarLinkStyle(isActive)}>
                          {cu.company.name}
                        </Link>
                        {isActive && (
                          <Flex direction="column" gap="0" mt="1">
                            {/* Channels sub-items */}
                            {activeChannels.length > 0 && (
                              <>
                                <Text size="1" color="gray"
                                  style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 12px" }}>
                                  Channels
                                </Text>
                                {activeChannels.map((ch) => (
                                  <Link key={ch.id} underline="none"
                                    href={`/dash/${cu.companyID}/${ch.id}`}
                                    style={subLinkStyle(false)}>
                                    {ch.icon} {ch.name}
                                  </Link>
                                ))}
                              </>
                            )}
                            {/* Tokens & Members */}
                            <Text size="1" color="gray" mt="1"
                              style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 12px" }}>
                              Settings
                            </Text>
                            <Link underline="none" href={`/dash/${cu.companyID}/tokens`}
                              style={subLinkStyle(pathname.includes("/tokens"))}>
                              Tokens
                            </Link>
                            <Link underline="none" href={`/dash/${cu.companyID}/members`}
                              style={subLinkStyle(pathname.includes("/members"))}>
                              Members
                            </Link>
                          </Flex>
                        )}
                      </Flex>
                    );
                  })}
                  {companyUsers.length === 0 && (
                    <Text size="2" color="gray" style={{ padding: "8px 12px" }}>
                      No companies yet
                    </Text>
                  )}
                </Flex>

                {/* User / Logout */}
                <Box style={{ marginTop: "auto" }}>
                  <Separator size="4" mb="3" />
                  <Flex align="center" justify="between" px="2">
                    <Text size="2" color="gray">{user.name}</Text>
                    <Form action={logout}>
                      <Button type="submit" variant="soft" size="1">Logout</Button>
                    </Form>
                  </Flex>
                </Box>
              </Flex>
            </Box>

            {/* Main Content */}
            <Box style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
              <Container size="3">{children}</Container>
            </Box>
          </Flex>
        </Theme>
      </body>
    </html>
  );
}

async function logout(_: any): Promise<ActionResult> {
  "use server";
  const { session } = await validateRequest();
  if (!session) {
    return { error: "Unauthorized" };
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
