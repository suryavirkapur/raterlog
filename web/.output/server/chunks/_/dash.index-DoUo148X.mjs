import { d as Route$5, e as createCompany } from './router-bujGOfVM.mjs';
import { useState } from 'react';
import { useRouter, Link } from '@tanstack/react-router';
import { jsxs, jsx } from 'react/jsx-runtime';
import { Flex, Box, Heading, Text, Card, Callout, TextField, Button, Grid, Badge } from '@radix-ui/themes';
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

function DashHome() {
  const { user, companies } = Route$5.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  async function onCreate(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setError(null);
    const res = await createCompany({ data: { name: String(fd.get("name") || "") } });
    setPending(false);
    if (res?.error) setError(res.error);
    else {
      form.reset();
      router.invalidate();
    }
  }
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "6",
    children: [
      /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsxs(Heading, {
        size: "6",
        mb: "1",
        children: ["Welcome back, ", user.name]
      }), /* @__PURE__ */ jsx(Text, {
        size: "3",
        color: "gray",
        children: "Manage your companies and monitoring channels"
      })] }),
      /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "3",
          children: [/* @__PURE__ */ jsx(Heading, {
            size: "4",
            children: "Create a Company"
          }), /* @__PURE__ */ jsxs("form", {
            onSubmit: onCreate,
            children: [error && /* @__PURE__ */ jsx(Callout.Root, {
              color: "red",
              size: "1",
              mb: "3",
              children: /* @__PURE__ */ jsx(Callout.Text, { children: error })
            }), /* @__PURE__ */ jsxs(Flex, {
              direction: "row",
              gap: "3",
              align: "end",
              children: [/* @__PURE__ */ jsxs("label", {
                style: { flex: 1 },
                children: [/* @__PURE__ */ jsx(Text, {
                  as: "div",
                  size: "2",
                  mb: "1",
                  weight: "medium",
                  children: "Company Name"
                }), /* @__PURE__ */ jsx(TextField.Root, {
                  name: "name",
                  placeholder: "Acme Corp",
                  size: "3"
                })]
              }), /* @__PURE__ */ jsx(Button, {
                type: "submit",
                size: "3",
                loading: pending,
                children: "Create"
              })]
            })]
          })]
        })
      }),
      companies.length > 0 && /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Heading, {
        size: "4",
        mb: "3",
        children: "Your Companies"
      }), /* @__PURE__ */ jsx(Grid, {
        columns: {
          initial: "1",
          md: "2"
        },
        gap: "3",
        children: companies.map((c) => /* @__PURE__ */ jsx(Link, {
          to: "/dash/$companyId",
          params: { companyId: c.id },
          style: { textDecoration: "none" },
          children: /* @__PURE__ */ jsx(Card, {
            size: "2",
            style: { cursor: "pointer" },
            children: /* @__PURE__ */ jsxs(Flex, {
              align: "center",
              justify: "between",
              children: [/* @__PURE__ */ jsxs(Flex, {
                direction: "column",
                gap: "1",
                children: [/* @__PURE__ */ jsx(Text, {
                  weight: "bold",
                  size: "3",
                  children: c.name
                }), /* @__PURE__ */ jsx(Text, {
                  size: "2",
                  color: "gray",
                  children: c.billing ? /* @__PURE__ */ jsx(Badge, {
                    color: "green",
                    variant: "soft",
                    children: "Active billing"
                  }) : /* @__PURE__ */ jsx(Badge, {
                    color: "gray",
                    variant: "soft",
                    children: "Free tier"
                  })
                })]
              }), /* @__PURE__ */ jsx(Text, {
                size: "2",
                color: "gray",
                children: "\u2192"
              })]
            })
          })
        }, c.id))
      })] })
    ]
  });
}

export { DashHome as component };
//# sourceMappingURL=dash.index-DoUo148X.mjs.map
