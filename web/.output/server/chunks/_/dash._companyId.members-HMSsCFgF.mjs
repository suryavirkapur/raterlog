import { k as Route$1, r as revokeInvite, m as sendInvite } from './router-bujGOfVM.mjs';
import { T as TabBar } from './TabBar-VRB6V2KD.mjs';
import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { Text, Flex, Card, Heading, Table, Badge, Button, Separator, Callout, TextField } from '@radix-ui/themes';
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

function MembersTab() {
  const { company, members, pendingInvites } = Route$1.useLoaderData();
  const { companyId } = Route$1.useParams();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  if (!company) return /* @__PURE__ */ jsx(Text, { children: "Company not found" });
  async function onInvite(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setError(null);
    const res = await sendInvite({ data: {
      companyId,
      email: String(fd.get("email") || "")
    } });
    setPending(false);
    if (res?.error) setError(res.error);
    else {
      form.reset();
      router.invalidate();
    }
  }
  async function onRevoke(inviteId) {
    await revokeInvite({ data: { inviteId } });
    router.invalidate();
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TabBar, {
    companyId: company.id,
    companyName: company.name,
    active: "members"
  }), /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    children: [
      /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "4",
          children: [/* @__PURE__ */ jsx(Heading, {
            size: "4",
            children: "Team Members"
          }), /* @__PURE__ */ jsxs(Table.Root, {
            variant: "surface",
            children: [/* @__PURE__ */ jsx(Table.Header, { children: /* @__PURE__ */ jsxs(Table.Row, { children: [
              /* @__PURE__ */ jsx(Table.ColumnHeaderCell, { children: "Name" }),
              /* @__PURE__ */ jsx(Table.ColumnHeaderCell, { children: "Email" }),
              /* @__PURE__ */ jsx(Table.ColumnHeaderCell, { children: "Status" })
            ] }) }), /* @__PURE__ */ jsxs(Table.Body, { children: [
              members.map((member) => /* @__PURE__ */ jsxs(Table.Row, { children: [
                /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, {
                  weight: "bold",
                  size: "2",
                  children: member.name
                }) }),
                /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, {
                  size: "2",
                  color: "gray",
                  children: member.email
                }) }),
                /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Badge, {
                  color: "green",
                  variant: "soft",
                  children: "Member"
                }) })
              ] }, member.id)),
              pendingInvites.map((invite) => /* @__PURE__ */ jsxs(Table.Row, { children: [
                /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, {
                  size: "2",
                  color: "gray",
                  children: "\u2014"
                }) }),
                /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, {
                  size: "2",
                  children: invite.email
                }) }),
                /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsxs(Flex, {
                  align: "center",
                  gap: "2",
                  children: [/* @__PURE__ */ jsx(Badge, {
                    color: "orange",
                    variant: "soft",
                    children: "Pending"
                  }), /* @__PURE__ */ jsx(Button, {
                    type: "button",
                    size: "1",
                    variant: "ghost",
                    color: "red",
                    onClick: () => onRevoke(invite.id),
                    children: "Revoke"
                  })]
                }) })
              ] }, invite.id)),
              members.length === 0 && pendingInvites.length === 0 && /* @__PURE__ */ jsx(Table.Row, { children: /* @__PURE__ */ jsx(Table.Cell, {
                colSpan: 3,
                children: /* @__PURE__ */ jsx(Text, {
                  color: "gray",
                  size: "2",
                  children: "No members yet"
                })
              }) })
            ] })]
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
            children: "Invite a Team Member"
          }), /* @__PURE__ */ jsxs("form", {
            onSubmit: onInvite,
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
                  children: "Email Address"
                }), /* @__PURE__ */ jsx(TextField.Root, {
                  name: "email",
                  type: "email",
                  placeholder: "colleague@company.com",
                  size: "3"
                })]
              }), /* @__PURE__ */ jsx(Button, {
                type: "submit",
                size: "3",
                loading: pending,
                children: "Send Invite"
              })]
            })]
          })]
        })
      })
    ]
  })] });
}

export { MembersTab as component };
//# sourceMappingURL=dash._companyId.members-HMSsCFgF.mjs.map
