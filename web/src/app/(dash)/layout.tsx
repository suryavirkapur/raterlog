import { api, apiOptional, type Channel, type Company, type User } from "@/lib/api";
import { LogoutButton } from "@/components/LogoutButton";
import {
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
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Raterlog",
  description: "Raterlog's Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await apiOptional<User>("/api/auth/me");
  if (!user) return redirect("/signin");

  const companies = await api<Company[]>("/api/companies");
  const pathname = headers().get("x-pathname") || headers().get("next-url") || "";
  let activeCompanyId: string | null = null;
  for (const company of companies) {
    if (pathname.includes(`/dash/${company.id}`)) {
      activeCompanyId = company.id;
      break;
    }
  }

  let activeChannels: Channel[] = [];
  if (activeCompanyId) {
    const detail = await apiOptional<{ channels: Channel[] }>(
      `/api/companies/${activeCompanyId}`
    );
    activeChannels = detail?.channels || [];
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
                <Box px="2">
                  <Heading size="4" style={{ letterSpacing: "-0.02em" }}>
                    Raterlog
                  </Heading>
                </Box>
                <Separator size="4" />
                <Flex direction="column" gap="1">
                  <Text
                    size="1"
                    weight="bold"
                    color="gray"
                    mb="1"
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontSize: "10px",
                      padding: "0 8px",
                    }}
                  >
                    Overview
                  </Text>
                  <Link
                    underline="none"
                    href="/dash"
                    style={sidebarLinkStyle(!activeCompanyId)}
                  >
                    Home
                  </Link>
                </Flex>
                <Separator size="4" />
                <Flex direction="column" gap="1">
                  <Text
                    size="1"
                    weight="bold"
                    color="gray"
                    mb="1"
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontSize: "10px",
                      padding: "0 8px",
                    }}
                  >
                    Companies
                  </Text>
                  {companies.map((company) => {
                    const isActive = activeCompanyId === company.id;
                    return (
                      <Flex direction="column" gap="0" key={company.id}>
                        <Link
                          underline="none"
                          href={`/dash/${company.id}`}
                          style={sidebarLinkStyle(isActive)}
                        >
                          {company.name}
                        </Link>
                        {isActive && (
                          <Flex direction="column" gap="0" mt="1">
                            {activeChannels.length > 0 && (
                              <>
                                <Text
                                  size="1"
                                  color="gray"
                                  style={{
                                    fontSize: "10px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    padding: "4px 12px",
                                  }}
                                >
                                  Channels
                                </Text>
                                {activeChannels.map((ch) => (
                                  <Link
                                    key={ch.id}
                                    underline="none"
                                    href={`/dash/${company.id}/${ch.id}`}
                                    style={subLinkStyle(false)}
                                  >
                                    {ch.icon} {ch.name}
                                  </Link>
                                ))}
                              </>
                            )}
                            <Text
                              size="1"
                              color="gray"
                              mt="1"
                              style={{
                                fontSize: "10px",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                padding: "4px 12px",
                              }}
                            >
                              Settings
                            </Text>
                            <Link
                              underline="none"
                              href={`/dash/${company.id}/tokens`}
                              style={subLinkStyle(pathname.includes("/tokens"))}
                            >
                              Tokens
                            </Link>
                            <Link
                              underline="none"
                              href={`/dash/${company.id}/members`}
                              style={subLinkStyle(pathname.includes("/members"))}
                            >
                              Members
                            </Link>
                          </Flex>
                        )}
                      </Flex>
                    );
                  })}
                  {companies.length === 0 && (
                    <Text size="2" color="gray" style={{ padding: "8px 12px" }}>
                      No companies yet
                    </Text>
                  )}
                </Flex>
                <Box style={{ marginTop: "auto" }}>
                  <Separator size="4" mb="3" />
                  <Flex align="center" justify="between" px="2">
                    <Text size="2" color="gray">
                      {user.name}
                    </Text>
                    <LogoutButton />
                  </Flex>
                </Box>
              </Flex>
            </Box>
            <Box style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
              <Container size="3">{children}</Container>
            </Box>
          </Flex>
        </Theme>
      </body>
    </html>
  );
}
