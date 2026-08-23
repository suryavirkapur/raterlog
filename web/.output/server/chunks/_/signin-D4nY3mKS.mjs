import { a as Route$7, b as loginFn } from './router-bujGOfVM.mjs';
import { A as AuthShell } from './AuthShell-CESdzkZE.mjs';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Card, Flex, Box, Heading, Text, Callout, TextField, Button } from '@radix-ui/themes';
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

function SigninPage() {
  const { email: inviteEmail, invite: inviteToken } = Route$7.useSearch();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await loginFn({ data: {
      email: String(fd.get("email") || ""),
      password: String(fd.get("password") || ""),
      inviteToken: inviteToken || void 0
    } });
    setPending(false);
    if (res?.error) setError(res.error);
    else if (res?.redirect) window.location.assign(res.redirect);
  }
  return /* @__PURE__ */ jsx(AuthShell, { children: /* @__PURE__ */ jsx(Card, {
    size: "3",
    style: {
      width: "100%",
      maxWidth: "420px"
    },
    children: /* @__PURE__ */ jsxs(Flex, {
      direction: "column",
      gap: "5",
      children: [
        /* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Heading, {
          size: "6",
          mb: "1",
          children: "Welcome back"
        }), /* @__PURE__ */ jsx(Text, {
          size: "2",
          color: "gray",
          children: "Sign in to your account"
        })] }),
        inviteToken && /* @__PURE__ */ jsx(Callout.Root, {
          color: "blue",
          size: "1",
          children: /* @__PURE__ */ jsx(Callout.Text, { children: "Sign in to accept your team invitation." })
        }),
        /* @__PURE__ */ jsxs("form", {
          onSubmit,
          children: [error && /* @__PURE__ */ jsx(Callout.Root, {
            color: "red",
            size: "1",
            mb: "3",
            children: /* @__PURE__ */ jsx(Callout.Text, { children: error })
          }), /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "4",
            children: [
              /* @__PURE__ */ jsxs("label", { children: [/* @__PURE__ */ jsx(Text, {
                as: "div",
                size: "2",
                mb: "1",
                weight: "medium",
                children: "Email"
              }), /* @__PURE__ */ jsx(TextField.Root, {
                type: "email",
                name: "email",
                placeholder: "you@example.com",
                size: "3",
                defaultValue: inviteEmail
              })] }),
              /* @__PURE__ */ jsxs("label", { children: [/* @__PURE__ */ jsx(Text, {
                as: "div",
                size: "2",
                mb: "1",
                weight: "medium",
                children: "Password"
              }), /* @__PURE__ */ jsx(TextField.Root, {
                type: "password",
                name: "password",
                placeholder: "Your password",
                size: "3"
              })] }),
              /* @__PURE__ */ jsx(Button, {
                type: "submit",
                size: "3",
                mt: "1",
                loading: pending,
                children: "Sign in"
              })
            ]
          })]
        }),
        /* @__PURE__ */ jsxs(Text, {
          size: "2",
          align: "center",
          color: "gray",
          children: [
            "Don't have an account?",
            " ",
            /* @__PURE__ */ jsx(Link, {
              to: "/signup",
              search: {
                email: inviteEmail,
                invite: inviteToken
              },
              style: { color: "var(--accent-9)" },
              children: "Sign up"
            })
          ]
        })
      ]
    })
  }) });
}

export { SigninPage as component };
//# sourceMappingURL=signin-D4nY3mKS.mjs.map
