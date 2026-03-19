import { validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { ActionResult, Form } from "@/lib/form";
import { sendInviteEmail } from "@/lib/mail";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
  Badge,
  Separator,
  Code,
  Table,
} from "@radix-ui/themes";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import React from "react";
import LiveLogs from "@/components/LiveLogs";
import { TokenCard } from "@/components/TokenCard";

function TabBar({ companyId, companyName, active }: { companyId: string; companyName: string; active: string }) {
  const tabs = [
    { key: "channels", label: "Channels", href: `/dash/${companyId}` },
    { key: "tokens", label: "Tokens", href: `/dash/${companyId}/tokens` },
    { key: "members", label: "Members", href: `/dash/${companyId}/members` },
  ];

  return (
    <Box mb="5">
      <Heading size="6" mb="4">{companyName}</Heading>
      <Flex gap="1" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              textDecoration: "none",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: active === tab.key ? 600 : 400,
              color: active === tab.key ? "var(--accent-9)" : "var(--gray-11)",
              borderBottom: active === tab.key ? "2px solid var(--accent-9)" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </Flex>
    </Box>
  );
}

export default async function Page({ params }: { params: { slug: string[] } }) {
  const res = await db.company.findFirst({
    where: { id: params.slug[0] },
    include: {
      Channel: true,
      CompanyUser: true,
      Token: true,
      Invite: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!res) return <Text>Company not found</Text>;

  // ─── Channels tab (default when slug.length === 1) ───
  if (params.slug.length === 1 || params.slug[1] === "channels") {
    const channels = res.Channel;

    const createChannel = async (_: any, formData: FormData): Promise<ActionResult> => {
      "use server";
      const name = formData.get("name");
      const emoji = formData.get("emoji");
      if (typeof name !== "string" || name.trim() == "")
        return { error: "Name is empty" };
      if (typeof emoji !== "string" || emoji.trim() == "")
        return { error: "Emoji is empty" };
      await db.channel.create({
        data: {
          companyID: res.id,
          name: name,
          icon: emoji,
          id: generateId(15),
        },
      });
      revalidatePath(`/dash/${res.id}`);
      return { error: "" };
    };

    return (
      <>
        <TabBar companyId={res.id} companyName={res.name} active="channels" />
        <Flex direction="column" gap="4">
          {channels.length > 0 ? (
            <Flex direction="column" gap="2">
              {channels.map((channel) => (
                <Link
                  href={`/dash/${res.id}/${channel.id}`}
                  key={channel.id}
                  style={{ textDecoration: "none" }}
                >
                  <Card size="2" style={{ cursor: "pointer", transition: "background-color 0.15s" }}>
                    <Flex align="center" gap="3">
                      <Text size="5">{channel.icon}</Text>
                      <Flex direction="column" gap="1">
                        <Text weight="bold" size="3">{channel.name}</Text>
                        <Text size="1" color="gray">
                          <Code size="1">{channel.id}</Code>
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>
                </Link>
              ))}
            </Flex>
          ) : (
            <Card size="2">
              <Flex direction="column" align="center" gap="2" py="4">
                <Text color="gray">No channels yet</Text>
                <Text size="2" color="gray">Create your first channel below to start logging events</Text>
              </Flex>
            </Card>
          )}

          <Separator size="4" />

          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Create a Channel</Heading>
              <Form action={createChannel}>
                <Flex direction="row" gap="3" align="end">
                  <label style={{ flex: 1 }}>
                    <Text as="div" size="2" mb="1" weight="medium">Channel Name</Text>
                    <TextField.Root name="name" placeholder="e.g. signups, errors, purchases" size="3" />
                  </label>
                  <label style={{ width: "100px" }}>
                    <Text as="div" size="2" mb="1" weight="medium">Icon</Text>
                    <TextField.Root name="emoji" placeholder="&#x1F680;" size="3" />
                  </label>
                  <Button type="submit" size="3">Create</Button>
                </Flex>
              </Form>
            </Flex>
          </Card>
        </Flex>
      </>
    );
  }

  // ─── Tokens tab ───
  if (params.slug.length === 2 && params.slug[1] === "tokens") {
    const deleteToken = async (_: any, formData: FormData): Promise<ActionResult> => {
      "use server";
      const id = formData.get("tokenId");
      if (typeof id !== "string") return { error: "Invalid token" };
      await db.token.delete({ where: { id: parseInt(id, 10) } });
      revalidatePath(`/dash/${res.id}/tokens`);
      return { error: "" };
    };

    const createToken = async (_: any, formData: FormData): Promise<ActionResult> => {
      "use server";
      const name = formData.get("name");
      if (typeof name !== "string" || name.trim() === "") return { error: "Token name is required" };
      const { user } = await validateRequest();
      if (!user) return { error: "Unauthorized" };
      await db.token.create({
        data: { token: generateId(20), companyID: res.id, name },
      });
      revalidatePath(`/dash/${res.id}/tokens`);
      return { error: "" };
    };

    const tokens = res.Token;
    return (
      <>
        <TabBar companyId={res.id} companyName={res.name} active="tokens" />
        <Flex direction="column" gap="4">
          {tokens.length > 0 ? (
            <Flex direction="column" gap="2">
              {tokens.map((token) => (
                <TokenCard
                  key={token.id}
                  tokenId={token.id}
                  name={token.name}
                  token={token.token}
                  deleteAction={deleteToken}
                />
              ))}
            </Flex>
          ) : (
            <Card size="2">
              <Flex direction="column" align="center" gap="2" py="4">
                <Text color="gray">No tokens yet</Text>
                <Text size="2" color="gray">Create a token to authenticate API requests</Text>
              </Flex>
            </Card>
          )}

          <Separator size="4" />

          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Create a Token</Heading>
              <Form action={createToken}>
                <Flex direction="row" gap="3" align="end">
                  <label style={{ flex: 1 }}>
                    <Text as="div" size="2" mb="1" weight="medium">Token Name</Text>
                    <TextField.Root name="name" placeholder="e.g. production-server, staging" size="3" />
                  </label>
                  <Button type="submit" size="3">Generate Token</Button>
                </Flex>
              </Form>
            </Flex>
          </Card>
        </Flex>
      </>
    );
  }

  // ─── Members tab ───
  if (params.slug.length === 2 && params.slug[1] === "members") {
    const memberIds = res.CompanyUser.map((cu) => cu.userID);
    const members = memberIds.length > 0
      ? await db.user.findMany({ where: { id: { in: memberIds } } })
      : [];
    const pendingInvites = res.Invite.filter((i) => i.status === "pending");

    const sendInvite = async (_: any, formData: FormData): Promise<ActionResult> => {
      "use server";
      const email = formData.get("email");
      if (typeof email !== "string" || !email.includes("@"))
        return { error: "Valid email is required" };
      const { user } = await validateRequest();
      if (!user) return { error: "Unauthorized" };

      const existingUser = await db.user.findFirst({ where: { email } });
      if (existingUser) {
        const alreadyMember = await db.companyUser.findFirst({
          where: { companyID: res.id, userID: existingUser.id },
        });
        if (alreadyMember) return { error: "User is already a member" };
      }

      const existingInvite = await db.invite.findFirst({
        where: { email, companyID: res.id, status: "pending" },
      });
      if (existingInvite) return { error: "Invite already sent to this email" };

      const inviteToken = generateId(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.invite.create({
        data: {
          id: generateId(15),
          email,
          companyID: res.id,
          token: inviteToken,
          status: "pending",
          expiresAt,
        },
      });

      await sendInviteEmail(email, res.name, inviteToken);
      revalidatePath(`/dash/${res.id}/members`);
      return { error: "" };
    };

    const revokeInvite = async (_: any, formData: FormData): Promise<ActionResult> => {
      "use server";
      const inviteId = formData.get("inviteId");
      if (typeof inviteId !== "string") return { error: "Invalid invite" };
      await db.invite.delete({ where: { id: inviteId } });
      revalidatePath(`/dash/${res.id}/members`);
      return { error: "" };
    };

    return (
      <>
        <TabBar companyId={res.id} companyName={res.name} active="members" />
        <Flex direction="column" gap="4">
          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Team Members</Heading>
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {members.map((member) => (
                    <Table.Row key={member.id}>
                      <Table.Cell><Text weight="bold" size="2">{member.name}</Text></Table.Cell>
                      <Table.Cell><Text size="2" color="gray">{member.email}</Text></Table.Cell>
                      <Table.Cell><Badge color="green" variant="soft">Member</Badge></Table.Cell>
                    </Table.Row>
                  ))}
                  {pendingInvites.map((invite) => (
                    <Table.Row key={invite.id}>
                      <Table.Cell><Text size="2" color="gray">&mdash;</Text></Table.Cell>
                      <Table.Cell><Text size="2">{invite.email}</Text></Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <Badge color="orange" variant="soft">Pending</Badge>
                          <Form action={revokeInvite}>
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <Button type="submit" size="1" variant="ghost" color="red">Revoke</Button>
                          </Form>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {members.length === 0 && pendingInvites.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={3}><Text color="gray" size="2">No members yet</Text></Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Flex>
          </Card>

          <Separator size="4" />

          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Invite a Team Member</Heading>
              <Form action={sendInvite}>
                <Flex direction="row" gap="3" align="end">
                  <label style={{ flex: 1 }}>
                    <Text as="div" size="2" mb="1" weight="medium">Email Address</Text>
                    <TextField.Root name="email" type="email" placeholder="colleague@company.com" size="3" />
                  </label>
                  <Button type="submit" size="3">Send Invite</Button>
                </Flex>
              </Form>
            </Flex>
          </Card>
        </Flex>
      </>
    );
  }

  // ─── Channel detail page ───
  if (params.slug.length === 2) {
    const channel = await db.channel.findFirst({
      where: { id: params.slug[1] },
      include: { company: true },
    });
    const token = await db.token.findFirst({
      where: { companyID: channel?.companyID },
    });
    if (!channel) return <Text>Channel not found</Text>;

    return (
      <Flex direction="column" gap="5">
        <Flex align="center" justify="between">
          <Box>
            <Flex align="center" gap="3" mb="1">
              <Text size="6">{channel.icon}</Text>
              <Heading size="6">{channel.name}</Heading>
            </Flex>
            <Text size="2" color="gray">
              Channel ID: <Code size="1">{channel.id}</Code>
            </Text>
          </Box>
          <Link href={`/dash/${channel.companyID}`}>
            <Button variant="soft" size="2">&larr; Back to channels</Button>
          </Link>
        </Flex>

        <Separator size="4" />

        <LiveLogs
          channelID={channel.id}
          token={token?.token || ""}
          icon={channel.icon}
        />
      </Flex>
    );
  }
}
