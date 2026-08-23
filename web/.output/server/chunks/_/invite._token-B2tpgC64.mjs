import { f as Route$4, g as acceptInvite } from './router-bujGOfVM.mjs';
import { A as AuthShell } from './AuthShell-CESdzkZE.mjs';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Flex, Heading, Text, Button, Badge, Callout, Separator, Card } from '@radix-ui/themes';
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

function Shell({ children }) {
  return /* @__PURE__ */ jsx(AuthShell, { children: /* @__PURE__ */ jsx(Card, {
    size: "3",
    style: {
      width: "100%",
      maxWidth: "420px"
    },
    children
  }) });
}
function InvitePage() {
  const { invite, user } = Route$4.useLoaderData();
  const { token } = Route$4.useParams();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  if (!invite) return /* @__PURE__ */ jsx(Shell, { children: /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    align: "center",
    children: [
      /* @__PURE__ */ jsx(Heading, {
        size: "5",
        children: "Invalid Invite"
      }),
      /* @__PURE__ */ jsx(Text, {
        color: "gray",
        align: "center",
        children: "This invitation link is invalid or has been removed."
      }),
      /* @__PURE__ */ jsx(Button, {
        asChild: true,
        variant: "soft",
        children: /* @__PURE__ */ jsx(Link, {
          to: "/",
          children: "Go home"
        })
      })
    ]
  }) });
  if (invite.status !== "pending") return /* @__PURE__ */ jsx(Shell, { children: /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    align: "center",
    children: [
      /* @__PURE__ */ jsx(Heading, {
        size: "5",
        children: "Invite Already Used"
      }),
      /* @__PURE__ */ jsx(Text, {
        color: "gray",
        align: "center",
        children: "This invitation has already been accepted."
      }),
      /* @__PURE__ */ jsx(Button, {
        asChild: true,
        children: /* @__PURE__ */ jsx(Link, {
          to: "/dash",
          children: "Go to Dashboard"
        })
      })
    ]
  }) });
  if (/* @__PURE__ */ new Date() > new Date(invite.expiresAt)) return /* @__PURE__ */ jsx(Shell, { children: /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    align: "center",
    children: [
      /* @__PURE__ */ jsx(Heading, {
        size: "5",
        children: "Invite Expired"
      }),
      /* @__PURE__ */ jsxs(Text, {
        color: "gray",
        align: "center",
        children: [
          "This invitation to ",
          /* @__PURE__ */ jsx("strong", { children: invite.companyName }),
          " has expired. Ask the team admin to send a new one."
        ]
      }),
      /* @__PURE__ */ jsx(Button, {
        asChild: true,
        variant: "soft",
        children: /* @__PURE__ */ jsx(Link, {
          to: "/",
          children: "Go home"
        })
      })
    ]
  }) });
  if (user) {
    if (user.email === invite.email) {
      async function onAccept() {
        setPending(true);
        setError(null);
        const res = await acceptInvite({ data: { token } });
        setPending(false);
        if (res?.error) setError(res.error);
        else if (res?.redirect) window.location.assign(res.redirect);
      }
      return /* @__PURE__ */ jsx(Shell, { children: /* @__PURE__ */ jsxs(Flex, {
        direction: "column",
        gap: "4",
        align: "center",
        children: [
          /* @__PURE__ */ jsx(Badge, {
            size: "2",
            variant: "soft",
            children: "Team Invitation"
          }),
          /* @__PURE__ */ jsxs(Heading, {
            size: "5",
            align: "center",
            children: ["Join ", invite.companyName]
          }),
          /* @__PURE__ */ jsxs(Text, {
            color: "gray",
            align: "center",
            size: "2",
            children: [
              "You (",
              user.email,
              ") have been invited to join",
              " ",
              /* @__PURE__ */ jsx("strong", { children: invite.companyName }),
              " on Raterlog."
            ]
          }),
          error && /* @__PURE__ */ jsx(Callout.Root, {
            color: "red",
            size: "1",
            children: /* @__PURE__ */ jsx(Callout.Text, { children: error })
          }),
          /* @__PURE__ */ jsx(Button, {
            size: "3",
            style: { width: "100%" },
            loading: pending,
            onClick: onAccept,
            children: "Accept & Join"
          })
        ]
      }) });
    }
    return /* @__PURE__ */ jsx(Shell, { children: /* @__PURE__ */ jsxs(Flex, {
      direction: "column",
      gap: "4",
      align: "center",
      children: [
        /* @__PURE__ */ jsx(Heading, {
          size: "5",
          children: "Wrong Account"
        }),
        /* @__PURE__ */ jsxs(Text, {
          color: "gray",
          align: "center",
          size: "2",
          children: [
            "This invite was sent to ",
            /* @__PURE__ */ jsx("strong", { children: invite.email }),
            " but you're logged in as ",
            /* @__PURE__ */ jsx("strong", { children: user.email }),
            "."
          ]
        }),
        /* @__PURE__ */ jsx(Separator, { size: "4" }),
        /* @__PURE__ */ jsx(Text, {
          size: "2",
          color: "gray",
          children: "Log out and sign in with the invited email, or create a new account."
        })
      ]
    }) });
  }
  return /* @__PURE__ */ jsx(Shell, { children: /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    align: "center",
    children: [
      /* @__PURE__ */ jsx(Badge, {
        size: "2",
        variant: "soft",
        children: "Team Invitation"
      }),
      /* @__PURE__ */ jsxs(Heading, {
        size: "5",
        align: "center",
        children: ["Join ", invite.companyName]
      }),
      /* @__PURE__ */ jsxs(Text, {
        color: "gray",
        align: "center",
        size: "2",
        children: [
          "You've been invited to join ",
          /* @__PURE__ */ jsx("strong", { children: invite.companyName }),
          " on Raterlog. Sign in or create an account to accept."
        ]
      }),
      /* @__PURE__ */ jsxs(Text, {
        size: "1",
        color: "gray",
        children: ["Invited: ", invite.email]
      }),
      /* @__PURE__ */ jsx(Separator, { size: "4" }),
      /* @__PURE__ */ jsxs(Flex, {
        direction: "column",
        gap: "3",
        style: { width: "100%" },
        children: [/* @__PURE__ */ jsx(Button, {
          size: "3",
          asChild: true,
          style: { width: "100%" },
          children: /* @__PURE__ */ jsx(Link, {
            to: "/signup",
            search: {
              email: invite.email,
              invite: token
            },
            children: "Create account"
          })
        }), /* @__PURE__ */ jsx(Button, {
          size: "3",
          variant: "outline",
          asChild: true,
          style: { width: "100%" },
          children: /* @__PURE__ */ jsx(Link, {
            to: "/signin",
            search: {
              email: invite.email,
              invite: token
            },
            children: "Sign in"
          })
        })]
      })
    ]
  }) });
}

export { InvitePage as component };
//# sourceMappingURL=invite._token-B2tpgC64.mjs.map
