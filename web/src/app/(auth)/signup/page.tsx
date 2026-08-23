"use client";

import { api } from "@/lib/api";
import { ActionResult, Form } from "@/lib/form";
import { Flex, Box, Button, Heading, Text, Card, TextField, Callout } from "@radix-ui/themes";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteEmail = searchParams.get("email") || "";
  const inviteToken = searchParams.get("invite") || "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/api/auth/me")
      .then(() => {
        router.replace(inviteToken ? `/invite/${inviteToken}` : "/dash");
      })
      .catch(() => setReady(true));
  }, [inviteToken, router]);

  if (!ready) return null;

  async function signup(formData: FormData): Promise<ActionResult> {
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
          invite_token: inviteToken,
        }),
      });
      router.push(inviteToken ? `/invite/${inviteToken}` : "/dash");
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign up failed" };
    }
  }

  return (
    <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
      <Flex direction="column" gap="5">
        <Box>
          <Heading size="6" mb="1">Create an account</Heading>
          <Text size="2" color="gray">Enter your details to get started</Text>
        </Box>
        {inviteToken && (
          <Callout.Root color="blue" size="1">
            <Callout.Text>You&apos;ve been invited to join a team. Create an account to accept.</Callout.Text>
          </Callout.Root>
        )}
        <Form action={signup}>
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="medium">Name</Text>
              <TextField.Root name="name" placeholder="Your name" size="3" />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="medium">Email</Text>
              <TextField.Root
                type="email"
                name="email"
                placeholder="you@example.com"
                size="3"
                defaultValue={inviteEmail}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="medium">Password</Text>
              <TextField.Root type="password" name="password" placeholder="Min 6 characters" size="3" />
            </label>
            <Button type="submit" size="3" mt="1">Create account</Button>
          </Flex>
        </Form>
        <Text size="2" align="center" color="gray">
          Already have an account?{" "}
          <Link href={`/signin${inviteToken ? `?email=${encodeURIComponent(inviteEmail)}&invite=${inviteToken}` : ""}`} style={{ color: "var(--accent-9)" }}>
            Sign in
          </Link>
        </Text>
      </Flex>
    </Card>
  );
}
