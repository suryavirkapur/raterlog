import { validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { ActionResult } from "@/lib/form";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
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
  if (!res) return;

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
      <>
        <div className="flex max-w-screen-sm mx-auto">
          <Flex direction="column">
            <Box>
              <Heading>Channels</Heading>
            </Box>
            <Flex direction="column">
              {channels.map((channel) => (
                <>
                  <Link href={`/dash/${res.id}/${channel.id}`} key={channel.id}>
                    {channel.icon}
                    {channel.name}
                  </Link>
                  <br />
                </>
              ))}
              <br />
              <Link href={`/dash/${params.slug}/tokens`}>
                {res.name}&apos;s Access Tokens
              </Link>
              <br />
              <form
                action={createChannel}
                style={{
                  margin: 4,
                  backgroundColor: "gray",
                  borderRadius: "5px",
                  alignContent: "center",
                  justifyItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <label htmlFor="name">Channel Name</label>
                <input name="name" type="string" id="name" />
                <br />
                <label htmlFor="emoji">Channel Icon</label>
                <input name="emoji" type="string" id="emoji" placeholder="😁" />
                <br />
                <Button type="submit">Add Channel</Button>
              </form>
            </Flex>
            <Box></Box>
          </Flex>
        </div>
      </>
    );
  }

  if (params.slug.length === 2 && params.slug[1] === "tokens") {
    // Tokens Page
    const deleteToken = async (id: number): Promise<ActionResult> => {
      "use server";
      console.log("X");
      await db.token.delete({
        where: {
          id: id,
        },
      });
      revalidatePath(`${res.id}/tokens`);
      return { error: "N/A" };
    };

    const createToken = async (formData: FormData): Promise<ActionResult> => {
      "use server";
      const name = formData.get("name");
      if (typeof name !== "string") return { error: "X" };
      const { user } = await validateRequest();
      if (!user) return { error: "No User" };
      await db.token.create({
        data: {
          token: generateId(20),
          companyID: res.id,
          name: name,
        },
      });
      revalidatePath(`${res.id}/tokens`);
      return { error: "N/A" };
    };

    const tokens = res.Token;
    return (
      <Flex direction="column">
        You have {tokens.length} tokens!
        {tokens.map((yo) => {
          const deleteWithBind = deleteToken.bind(null, yo.id);
          return (
            <Flex
              key={yo.id}
              style={{
                backgroundColor: "gray",
                padding: 4,
                borderRadius: "5px",
                margin: 2,
              }}
              direction="row"
              justify="between"
            >
              <Text style={{ width: "300px" }}>{yo.name}</Text>
              <Text style={{ width: "300px" }}>{yo.token}</Text>
              <form action={deleteWithBind}>
                <Button type="submit">X</Button>
              </form>
            </Flex>
          );
        })}
        <Flex
          style={{
            padding: 4,
            backgroundColor: "gray",
            borderRadius: "5px",
            margin: 2,
          }}
          direction="column"
        >
          <form action={createToken}>
            <label htmlFor="name">Name</label>
            <br />
            <input name="name" type="string" id="name" />
            <br />
            <Button type="submit"> Create Token</Button>
          </form>
        </Flex>
      </Flex>
    );
  }
  if (params.slug.length === 2) {
    const channel = await db.channel.findFirst({
      where: { id: params.slug[1] },
      include: { company: true },
    });
    const token = await db.token.findFirst({
      where: { companyID: channel?.companyID },
    });
    if (!channel) return;
    return (
      <div className="max-h-screen max-w-screen-sm mx-auto">
        <Box className="w-full">
          <Heading>
            {channel.icon}
            {channel.name}
          </Heading>
          <Text size="1" style={{ color: "grey" }}>
            Channel ID: {channel.id}
          </Text>
          <Box>
            <LiveLogs
              channelID={channel.id}
              token={token?.token || ""}
              icon={channel.icon}
            />
          </Box>
        </Box>
      </div>
    );
  }
}
