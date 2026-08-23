import { h as Route$3, i as createChannel } from './router-bujGOfVM.mjs';
import { T as TabBar } from './TabBar-VRB6V2KD.mjs';
import { useState } from 'react';
import { useRouter, Link } from '@tanstack/react-router';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { Text, Flex, Card, Code, Separator, Heading, Callout, TextField, Button } from '@radix-ui/themes';
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

function ChannelsTab() {
  const { company, channels } = Route$3.useLoaderData();
  const { companyId } = Route$3.useParams();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  if (!company) return /* @__PURE__ */ jsx(Text, { children: "Company not found" });
  async function onCreate(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setError(null);
    const res = await createChannel({ data: {
      companyId,
      name: String(fd.get("name") || ""),
      icon: String(fd.get("emoji") || "")
    } });
    setPending(false);
    if (res?.error) setError(res.error);
    else {
      form.reset();
      router.invalidate();
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TabBar, {
    companyId: company.id,
    companyName: company.name,
    active: "channels"
  }), /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    children: [
      channels.length > 0 ? /* @__PURE__ */ jsx(Flex, {
        direction: "column",
        gap: "2",
        children: channels.map((channel) => /* @__PURE__ */ jsx(Link, {
          to: "/dash/$companyId/$channelId",
          params: {
            companyId: company.id,
            channelId: channel.id
          },
          style: { textDecoration: "none" },
          children: /* @__PURE__ */ jsx(Card, {
            size: "2",
            style: { cursor: "pointer" },
            children: /* @__PURE__ */ jsxs(Flex, {
              align: "center",
              gap: "3",
              children: [/* @__PURE__ */ jsx(Text, {
                size: "5",
                children: channel.icon
              }), /* @__PURE__ */ jsxs(Flex, {
                direction: "column",
                gap: "1",
                children: [/* @__PURE__ */ jsx(Text, {
                  weight: "bold",
                  size: "3",
                  children: channel.name
                }), /* @__PURE__ */ jsx(Text, {
                  size: "1",
                  color: "gray",
                  children: /* @__PURE__ */ jsx(Code, {
                    size: "1",
                    children: channel.id
                  })
                })]
              })]
            })
          })
        }, channel.id))
      }) : /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          align: "center",
          gap: "2",
          py: "4",
          children: [/* @__PURE__ */ jsx(Text, {
            color: "gray",
            children: "No channels yet"
          }), /* @__PURE__ */ jsx(Text, {
            size: "2",
            color: "gray",
            children: "Create your first channel below to start logging events"
          })]
        })
      }),
      /* @__PURE__ */ jsx(Separator, { size: "4" }),
      /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "3",
          children: [/* @__PURE__ */ jsx(Heading, {
            size: "4",
            children: "Create a Channel"
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
              children: [
                /* @__PURE__ */ jsxs("label", {
                  style: { flex: 1 },
                  children: [/* @__PURE__ */ jsx(Text, {
                    as: "div",
                    size: "2",
                    mb: "1",
                    weight: "medium",
                    children: "Channel Name"
                  }), /* @__PURE__ */ jsx(TextField.Root, {
                    name: "name",
                    placeholder: "e.g. signups, errors, purchases",
                    size: "3"
                  })]
                }),
                /* @__PURE__ */ jsxs("label", {
                  style: { width: "100px" },
                  children: [/* @__PURE__ */ jsx(Text, {
                    as: "div",
                    size: "2",
                    mb: "1",
                    weight: "medium",
                    children: "Icon"
                  }), /* @__PURE__ */ jsx(TextField.Root, {
                    name: "emoji",
                    placeholder: "\u{1F680}",
                    size: "3"
                  })]
                }),
                /* @__PURE__ */ jsx(Button, {
                  type: "submit",
                  size: "3",
                  loading: pending,
                  children: "Create"
                })
              ]
            })]
          })]
        })
      })
    ]
  })] });
}

export { ChannelsTab as component };
//# sourceMappingURL=dash._companyId.index-CmjYqxnH.mjs.map
