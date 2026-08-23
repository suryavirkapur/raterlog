"use client";

import { Form, ActionResult } from "@/lib/form";
import { api } from "@/lib/api";
import { Box, Button, Flex, Heading, Text, Card, TextField, Callout } from "@radix-ui/themes";
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

  async function login(formData: FormData): Promise<ActionResult> {
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    try {
      await api("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          invite_token: inviteToken,
        }),
      });
      router.push(inviteToken ? `/invite/${inviteToken}` : "/dash");
      router.refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign in failed" };
    }
  }

  return (
    <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
      <Flex direction="column" gap="5">
        <Box>
          <Heading size="6" mb="1">Welcome back</Heading>
          <Text size="2" color="gray">Sign in to your account</Text>
        </Box>
        {inviteToken && (
          <Callout.Root color="blue" size="1">
            <Callout.Text>Sign in to accept your team invitation.</Callout.Text>
          </Callout.Root>
        )}
        <Form action={login}>
          <Flex direction="column" gap="4">
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
              <TextField.Root type="password" name="password" placeholder="Your password" size="3" />
            </label>
            <Button type="submit" size="3" mt="1">Sign in</Button>
          </Flex>
        </Form>
        <Text size="2" align="center" color="gray">
          Don&apos;t have an account?{" "}
          <Link href={`/signup${inviteToken ? `?email=${encodeURIComponent(inviteEmail)}&invite=${inviteToken}` : ""}`} style={{ color: "var(--accent-9)" }}>
            Sign up
          </Link>
        </Text>
      </Flex>
    </Card>
  );
}
