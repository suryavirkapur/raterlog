import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateRequest } from "@/lib/auth";
import db from "@/lib/db";
import { ActionResult } from "@/lib/form";
import { generateId } from "lucia";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import React from "react";

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
      if (typeof name !== "string" || name.trim() == "")
        return { error: "Name is empty" };
      await db.channel.create({
        data: {
          companyID: res.id,
          name: name,
          id: generateId(15),
        },
      });
      revalidatePath(`/dash/${res.id}`);
      return { error: "" };
    };
    
    return (
      <>
        <div className="flex max-w-screen-sm mx-auto">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Add Channel</CardTitle>
            </CardHeader>
            <CardContent>
              {channels.map((channel) => (
                <>
                  <Link href={`/dash/${res.id}/${channel.id}`} key={channel.id}>
                    {channel.name}
                  </Link>
                  <br />
                </>
              ))}
              <br />
              {JSON.stringify(res)}
              <br />
              <form action={createChannel}>
                <Label htmlFor="name">Channel Name</Label>
                <Input name="name" type="string" id="name" />
                <Button type="submit">Add Channel</Button>
              </form>
            </CardContent>
            <CardFooter>
              <Link href={`/dash/${params.slug}/tokens`}>
                {res.name}'s Access Tokens
              </Link>
            </CardFooter>
          </Card>
        </div>
      </>
    );
  }

  if (params.slug.length === 2 && params.slug[1] === "tokens") {
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
      console.log("yoobie");
      const name = formData.get("name");
      console.log(name);
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
      <>
        You have {tokens.length} tokens!
        {tokens.map((yo) => {
          const deleteWithBind = deleteToken.bind(null, yo.id);
          return (
            <div
              className="flex flex-row items-center justify-between bg-gray-300 rounded-md max-w-screen-sm mx-auto"
              key={yo.id}
            >
              <p>{yo.name + "=" + yo.token}</p>
              <form action={deleteWithBind}>
                <Button type="submit" variant="destructive">
                  X
                </Button>
              </form>
            </div>
          );
        })}
        <form action={createToken}>
          <Label htmlFor="name">Name</Label>
          <Input name="name" type="string" id="name" />
          <Button type="submit"> Create Token</Button>
        </form>
      </>
    );
  }
  if (params.slug.length === 2) {
    const channel = await db.channel.findFirst({
      where: { id: params.slug[1] },
      include: { Log: true },
    });
    if (!channel) return;
    const logs = channel.Log;
    return (
      <div className="max-h-screen max-w-screen-sm mx-auto">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{channel.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.map((x) => (
              <div key={x.timestamp}>
                {x.eventName}
                <br />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
}
