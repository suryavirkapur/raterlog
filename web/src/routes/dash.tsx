import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useParams,
} from "@tanstack/react-router";
import { Box, Button, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { api, apiOptional, type Company, type User } from "@/lib/api";

export const Route = createFileRoute("/dash")({
  loader: async () => {
    const user = await apiOptional<User>("/api/auth/me");
    if (!user) throw redirect({ to: "/signin" });
    const companies = await api<Company[]>("/api/companies");
    return { user, companies };
  },
  component: DashLayout,
});

const linkStyle = (isActive: boolean) => ({
  padding: "7px 12px",
  borderRadius: "var(--radius-3)",
  color: isActive ? "var(--accent-9)" : "var(--gray-11)",
  background: isActive ? "var(--accent-a3)" : "transparent",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: isActive ? 600 : 400,
  display: "block",
});

const subLinkStyle = {
  padding: "5px 12px 5px 24px",
  borderRadius: "var(--radius-3)",
  color: "var(--gray-10)",
  textDecoration: "none",
  fontSize: "12px",
  display: "block",
};

function DashLayout() {
  const { user, companies } = Route.useLoaderData();
  const params = useParams({ strict: false }) as { companyId?: string };
  const activeCompanyId = params.companyId;

  async function onLogout() {
    try {
      await api("/api/auth/signout", { method: "POST", body: "{}" });
    } catch {
      // ignore
    }
    window.location.assign("/");
  }

  return (
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
            <Link to="/dash" style={linkStyle(!activeCompanyId)}>
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
                    to="/dash/$companyId"
                    params={{ companyId: company.id }}
                    style={linkStyle(isActive)}
                  >
                    {company.name}
                  </Link>
                  {isActive && (
                    <Flex direction="column" gap="0" mt="1">
                      <Link
                        to="/dash/$companyId"
                        params={{ companyId: company.id }}
                        style={subLinkStyle}
                      >
                        Channels
                      </Link>
                      <Link
                        to="/dash/$companyId/tokens"
                        params={{ companyId: company.id }}
                        style={subLinkStyle}
                      >
                        Tokens
                      </Link>
                      <Link
                        to="/dash/$companyId/members"
                        params={{ companyId: company.id }}
                        style={subLinkStyle}
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
              <Button variant="soft" size="1" onClick={onLogout}>
                Logout
              </Button>
            </Flex>
          </Box>
        </Flex>
      </Box>

      <Box style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
        <Outlet />
      </Box>
    </Flex>
  );
}
