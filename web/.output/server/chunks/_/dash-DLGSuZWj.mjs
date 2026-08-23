import { R as Route$8, l as logoutFn } from './router-bujGOfVM.mjs';
import { useParams, Link, Outlet } from '@tanstack/react-router';
import { jsxs, jsx } from 'react/jsx-runtime';
import { Flex, Box, Heading, Separator, Text, Button } from '@radix-ui/themes';
import '../virtual/entry.mjs';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@tanstack/react-router/ssr/server';
import 'node:async_hooks';
import 'rou3';
import 'srvx';
import '@tanstack/router-core';
import '@tanstack/router-core/ssr/client';
import 'seroval';
import '@tanstack/history';
import '@tanstack/router-core/ssr/server';

var linkStyle = (isActive) => ({
  padding: "7px 12px",
  borderRadius: "var(--radius-3)",
  color: isActive ? "var(--accent-9)" : "var(--gray-11)",
  background: isActive ? "var(--accent-a3)" : "transparent",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: isActive ? 600 : 400,
  display: "block"
});
var subLinkStyle = {
  padding: "5px 12px 5px 24px",
  borderRadius: "var(--radius-3)",
  color: "var(--gray-10)",
  textDecoration: "none",
  fontSize: "12px",
  display: "block"
};
function DashLayout() {
  const { user, companies } = Route$8.useLoaderData();
  const activeCompanyId = useParams({ strict: false }).companyId;
  async function onLogout() {
    const res = await logoutFn();
    window.location.assign(res?.redirect || "/");
  }
  return /* @__PURE__ */ jsxs(Flex, {
    style: { minHeight: "100vh" },
    children: [/* @__PURE__ */ jsx(Box, {
      style: {
        width: "240px",
        borderRight: "1px solid var(--gray-a5)",
        padding: "16px 12px",
        flexShrink: 0,
        overflowY: "auto"
      },
      children: /* @__PURE__ */ jsxs(Flex, {
        direction: "column",
        gap: "4",
        style: { height: "100%" },
        children: [
          /* @__PURE__ */ jsx(Box, {
            px: "2",
            children: /* @__PURE__ */ jsx(Heading, {
              size: "4",
              style: { letterSpacing: "-0.02em" },
              children: "Raterlog"
            })
          }),
          /* @__PURE__ */ jsx(Separator, { size: "4" }),
          /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "1",
            children: [/* @__PURE__ */ jsx(Text, {
              size: "1",
              weight: "bold",
              color: "gray",
              mb: "1",
              style: {
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "10px",
                padding: "0 8px"
              },
              children: "Overview"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/dash",
              style: linkStyle(!activeCompanyId),
              children: "Home"
            })]
          }),
          /* @__PURE__ */ jsx(Separator, { size: "4" }),
          /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "1",
            children: [
              /* @__PURE__ */ jsx(Text, {
                size: "1",
                weight: "bold",
                color: "gray",
                mb: "1",
                style: {
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "10px",
                  padding: "0 8px"
                },
                children: "Companies"
              }),
              companies.map((c) => {
                const isActive = activeCompanyId === c.id;
                return /* @__PURE__ */ jsxs(Flex, {
                  direction: "column",
                  gap: "0",
                  children: [/* @__PURE__ */ jsx(Link, {
                    to: "/dash/$companyId",
                    params: { companyId: c.id },
                    style: linkStyle(isActive),
                    children: c.name
                  }), isActive && /* @__PURE__ */ jsxs(Flex, {
                    direction: "column",
                    gap: "0",
                    mt: "1",
                    children: [
                      /* @__PURE__ */ jsx(Link, {
                        to: "/dash/$companyId",
                        params: { companyId: c.id },
                        style: subLinkStyle,
                        children: "Channels"
                      }),
                      /* @__PURE__ */ jsx(Link, {
                        to: "/dash/$companyId/tokens",
                        params: { companyId: c.id },
                        style: subLinkStyle,
                        children: "Tokens"
                      }),
                      /* @__PURE__ */ jsx(Link, {
                        to: "/dash/$companyId/members",
                        params: { companyId: c.id },
                        style: subLinkStyle,
                        children: "Members"
                      })
                    ]
                  })]
                }, c.id);
              }),
              companies.length === 0 && /* @__PURE__ */ jsx(Text, {
                size: "2",
                color: "gray",
                style: { padding: "8px 12px" },
                children: "No companies yet"
              })
            ]
          }),
          /* @__PURE__ */ jsxs(Box, {
            style: { marginTop: "auto" },
            children: [/* @__PURE__ */ jsx(Separator, {
              size: "4",
              mb: "3"
            }), /* @__PURE__ */ jsxs(Flex, {
              align: "center",
              justify: "between",
              px: "2",
              children: [/* @__PURE__ */ jsx(Text, {
                size: "2",
                color: "gray",
                children: user.name
              }), /* @__PURE__ */ jsx(Button, {
                variant: "soft",
                size: "1",
                onClick: onLogout,
                children: "Logout"
              })]
            })]
          })
        ]
      })
    }), /* @__PURE__ */ jsx(Box, {
      style: {
        flex: 1,
        padding: "28px 36px",
        overflowY: "auto"
      },
      children: /* @__PURE__ */ jsx(Outlet, {})
    })]
  });
}

export { DashLayout as component };
//# sourceMappingURL=dash-DLGSuZWj.mjs.map
