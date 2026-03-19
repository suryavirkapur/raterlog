import { validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { ActionResult, Form } from "@/lib/form";
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
} from "@radix-ui/themes";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import React from "react";
import LiveLogs from "@/components/LiveLogs";

export default async function Page({ params }: { params: { slug: string[] } }) {
  const res = await db.company.findFirst({
    where: { id: params.slug[0] },
    include: { Channel: true, CompanyUser: true, Token: true },
  });
  if (!res) return <Text>Company not found</Text>;

  // Company channels page
  if (params.slug.length === 1) {
    const channels = res.Channel;

    const createChannel = async (formData: FormData): Promise<ActionResult> => {
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
      <Flex direction="column" gap="6">
        <Flex align="center" justify="between">
          <Box>
            <Heading size="6" mb="1">{res.name}</Heading>
            <Text size="3" color="gray">
              {channels.length} channel{channels.length !== 1 ? "s" : ""}
            </Text>
          </Box>
          <Link href={`/dash/${params.slug}/tokens`}>
            <Button variant="soft" size="2">Manage Tokens</Button>
          </Link>
        </Flex>

        {/* Channels List */}
        {channels.length > 0 ? (
          <Flex direction="column" gap="2">
            {channels.map((channel) => (
              <Link
                href={`/dash/${res.id}/${channel.id}`}
                key={channel.id}
                style={{ textDecoration: "none" }}
              >
                <Card
                  size="2"
                  style={{
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                  }}
                >
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

        {/* Create Channel */}
        <Card size="2">
          <Flex direction="column" gap="3">
            <Heading size="4">Create a Channel</Heading>
            <Form action={createChannel}>
              <Flex direction="row" gap="3" align="end">
                <label style={{ flex: 1 }}>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Channel Name
                  </Text>
                  <TextField.Root
                    name="name"
                    placeholder="e.g. signups, errors, purchases"
                    size="3"
                  />
                </label>
                <label style={{ width: "100px" }}>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Icon
                  </Text>
                  <TextField.Root
                    name="emoji"
                    placeholder="&#x1F680;"
                    size="3"
                  />
                </label>
                <Button type="submit" size="3">
                  Create
                </Button>
              </Flex>
            </Form>
          </Flex>
        </Card>
      </Flex>
    );
  }

  // Tokens page
  if (params.slug.length === 2 && params.slug[1] === "tokens") {
    const deleteToken = async (_: any, formData: FormData): Promise<ActionResult> => {
      "use server";
      const id = formData.get("tokenId");
      if (typeof id !== "string") return { error: "Invalid token" };
      await db.token.delete({
        where: {
          id: parseInt(id, 10),
        },
      });
      revalidatePath(`/dash/${res.id}/tokens`);
      return { error: "" };
    };

    const createToken = async (formData: FormData): Promise<ActionResult> => {
      "use server";
      const name = formData.get("name");
      if (typeof name !== "string" || name.trim() === "") return { error: "Token name is required" };
      const { user } = await validateRequest();
      if (!user) return { error: "Unauthorized" };
      await db.token.create({
        data: {
          token: generateId(20),
          companyID: res.id,
          name: name,
        },
      });
      revalidatePath(`/dash/${res.id}/tokens`);
      return { error: "" };
    };

    const tokens = res.Token;
    return (
      <Flex direction="column" gap="6">
        <Flex align="center" justify="between">
          <Box>
            <Heading size="6" mb="1">{res.name} Tokens</Heading>
            <Text size="3" color="gray">
              {tokens.length} token{tokens.length !== 1 ? "s" : ""} for API access
            </Text>
          </Box>
          <Link href={`/dash/${res.id}`}>
            <Button variant="soft" size="2">&larr; Back to channels</Button>
          </Link>
        </Flex>

        {/* Tokens List */}
        {tokens.length > 0 ? (
          <Flex direction="column" gap="2">
            {tokens.map((token) => {
              return (
                <Card key={token.id} size="2">
                  <Flex align="center" justify="between">
                    <Flex direction="column" gap="1">
                      <Text weight="bold" size="3">{token.name}</Text>
                      <Code size="2" style={{ userSelect: "all" }}>{token.token}</Code>
                    </Flex>
                    <Form action={deleteToken}>
                      <input type="hidden" name="tokenId" value={token.id} />
                      <Button type="submit" variant="soft" color="red" size="2">
                        Delete
                      </Button>
                    </Form>
                  </Flex>
                </Card>
              );
            })}
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

        {/* Create Token */}
        <Card size="2">
          <Flex direction="column" gap="3">
            <Heading size="4">Create a Token</Heading>
            <Form action={createToken}>
              <Flex direction="row" gap="3" align="end">
                <label style={{ flex: 1 }}>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Token Name
                  </Text>
                  <TextField.Root
                    name="name"
                    placeholder="e.g. production-server, staging"
                    size="3"
                  />
                </label>
                <Button type="submit" size="3">
                  Generate Token
                </Button>
              </Flex>
            </Form>
          </Flex>
        </Card>
      </Flex>
    );
  }

  // Channel detail page
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
            <Button variant="soft" size="2">&larr; Back</Button>
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
