import { Link } from '@tanstack/react-router';
import { jsxs, jsx } from 'react/jsx-runtime';
import { Box, Heading, Flex } from '@radix-ui/themes';

function TabBar({ companyId, companyName, active }) {
  return /* @__PURE__ */ jsxs(Box, {
    mb: "5",
    children: [/* @__PURE__ */ jsx(Heading, {
      size: "6",
      mb: "4",
      children: companyName
    }), /* @__PURE__ */ jsx(Flex, {
      gap: "1",
      style: { borderBottom: "1px solid var(--gray-a5)" },
      children: [
        {
          key: "channels",
          label: "Channels",
          to: "/dash/$companyId"
        },
        {
          key: "tokens",
          label: "Tokens",
          to: "/dash/$companyId/tokens"
        },
        {
          key: "members",
          label: "Members",
          to: "/dash/$companyId/members"
        }
      ].map((tab) => /* @__PURE__ */ jsx(Link, {
        to: tab.to,
        params: { companyId },
        style: {
          textDecoration: "none",
          padding: "10px 20px",
          fontSize: "14px",
          fontWeight: active === tab.key ? 600 : 400,
          color: active === tab.key ? "var(--accent-9)" : "var(--gray-11)",
          borderBottom: active === tab.key ? "2px solid var(--accent-9)" : "2px solid transparent",
          marginBottom: "-1px"
        },
        children: tab.label
      }, tab.key))
    })]
  });
}

export { TabBar as T };
//# sourceMappingURL=TabBar-VRB6V2KD.mjs.map
