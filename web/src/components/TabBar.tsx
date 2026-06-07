import { Box, Flex, Heading } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

export function TabBar({
  companyId,
  companyName,
  active,
}: {
  companyId: string;
  companyName: string;
  active: "channels" | "tokens" | "members";
}) {
  const tabs = [
    { key: "channels", label: "Channels", to: "/dash/$companyId" as const },
    { key: "tokens", label: "Tokens", to: "/dash/$companyId/tokens" as const },
    { key: "members", label: "Members", to: "/dash/$companyId/members" as const },
  ];

  return (
    <Box mb="5">
      <Heading size="6" mb="4">
        {companyName}
      </Heading>
      <Flex gap="1" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={tab.to}
            params={{ companyId }}
            style={{
              textDecoration: "none",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: active === tab.key ? 600 : 400,
              color: active === tab.key ? "var(--accent-9)" : "var(--gray-11)",
              borderBottom:
                active === tab.key
                  ? "2px solid var(--accent-9)"
                  : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </Flex>
    </Box>
  );
}
