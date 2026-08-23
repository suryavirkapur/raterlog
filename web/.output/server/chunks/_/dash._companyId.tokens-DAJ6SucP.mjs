import { n as Route, o as deleteToken, p as createToken } from './router-bujGOfVM.mjs';
import { T as TabBar } from './TabBar-VRB6V2KD.mjs';
import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { Text, Flex, Card, Separator, Heading, Callout, TextField, Button, Code } from '@radix-ui/themes';
import { EyeOff, Eye } from 'lucide-react';
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

function TokenCard({ tokenId, name, token, onDelete }) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  return /* @__PURE__ */ jsx(Card, {
    size: "2",
    children: /* @__PURE__ */ jsxs(Flex, {
      align: "center",
      justify: "between",
      children: [/* @__PURE__ */ jsxs(Flex, {
        direction: "column",
        gap: "1",
        style: {
          minWidth: 0,
          flex: 1
        },
        children: [/* @__PURE__ */ jsx(Text, {
          weight: "bold",
          size: "3",
          children: name
        }), /* @__PURE__ */ jsxs(Flex, {
          align: "center",
          gap: "2",
          children: [/* @__PURE__ */ jsx(Code, {
            size: "2",
            style: { userSelect: "all" },
            children: visible ? token : "\u2022".repeat(24)
          }), /* @__PURE__ */ jsx("button", {
            type: "button",
            onClick: () => setVisible(!visible),
            style: {
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--gray-10)",
              padding: "2px",
              display: "flex",
              alignItems: "center"
            },
            children: visible ? /* @__PURE__ */ jsx(EyeOff, { size: 16 }) : /* @__PURE__ */ jsx(Eye, { size: 16 })
          })]
        })]
      }), /* @__PURE__ */ jsx(Button, {
        type: "button",
        variant: "soft",
        color: "red",
        size: "2",
        loading: pending,
        onClick: async () => {
          setPending(true);
          await onDelete(tokenId);
          setPending(false);
        },
        children: "Delete"
      })]
    })
  });
}
function TokensTab() {
  const { company, tokens } = Route.useLoaderData();
  const { companyId } = Route.useParams();
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
    const res = await createToken({ data: {
      companyId,
      name: String(fd.get("name") || "")
    } });
    setPending(false);
    if (res?.error) setError(res.error);
    else {
      form.reset();
      router.invalidate();
    }
  }
  async function onDelete(tokenId) {
    await deleteToken({ data: { tokenId } });
    router.invalidate();
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TabBar, {
    companyId: company.id,
    companyName: company.name,
    active: "tokens"
  }), /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    children: [
      tokens.length > 0 ? /* @__PURE__ */ jsx(Flex, {
        direction: "column",
        gap: "2",
        children: tokens.map((token) => /* @__PURE__ */ jsx(TokenCard, {
          tokenId: token.id,
          name: token.name,
          token: token.token,
          onDelete
        }, token.id))
      }) : /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          align: "center",
          gap: "2",
          py: "4",
          children: [/* @__PURE__ */ jsx(Text, {
            color: "gray",
            children: "No tokens yet"
          }), /* @__PURE__ */ jsx(Text, {
            size: "2",
            color: "gray",
            children: "Create a token to authenticate API requests"
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
            children: "Create a Token"
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
                  children: "Token Name"
                }), /* @__PURE__ */ jsx(TextField.Root, {
                  name: "name",
                  placeholder: "e.g. production-server, staging",
                  size: "3"
                })]
              }), /* @__PURE__ */ jsx(Button, {
                type: "submit",
                size: "3",
                loading: pending,
                children: "Generate Token"
              })]
            })]
          })]
        })
      })
    ]
  })] });
}

export { TokensTab as component };
//# sourceMappingURL=dash._companyId.tokens-DAJ6SucP.mjs.map
