import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { api, apiOptional, type User } from "@/lib/api";
import AuthShell from "@/components/AuthShell";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    invite: typeof search.invite === "string" ? search.invite : "",
  }),
  beforeLoad: async ({ search }) => {
    const me = await apiOptional<User>("/api/auth/me");
    if (me) {
      if (search.invite) {
        throw redirect({ to: "/invite/$token", params: { token: search.invite } });
      }
      throw redirect({ to: "/dash" });
    }
  },
  component: SignupPage,
});

function SignupPage() {
  const { email: inviteEmail, invite: inviteToken } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: String(fd.get("name") || ""),
          email: String(fd.get("email") || ""),
          password: String(fd.get("password") || ""),
          invite_token: inviteToken,
        }),
      });
      window.location.assign(inviteToken ? `/invite/${inviteToken}` : "/dash");
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Sign up failed");
    }
  }

  return (
    <AuthShell>
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="5">
          <Box>
            <Heading size="6" mb="1">
              Create an account
            </Heading>
            <Text size="2" color="gray">
              Enter your details to get started
            </Text>
          </Box>
          {inviteToken && (
            <Callout.Root color="blue" size="1">
              <Callout.Text>
                You&apos;ve been invited to join a team. Create an account to
                accept.
              </Callout.Text>
            </Callout.Root>
          )}
          <form onSubmit={onSubmit}>
            {error && (
              <Callout.Root color="red" size="1" mb="3">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}
            <Flex direction="column" gap="4">
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Name
                </Text>
                <TextField.Root name="name" placeholder="Your name" size="3" />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Email
                </Text>
                <TextField.Root
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  size="3"
                  defaultValue={inviteEmail}
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Password
                </Text>
                <TextField.Root
                  type="password"
                  name="password"
                  placeholder="Min 6 characters"
                  size="3"
                />
              </label>
              <Button type="submit" size="3" mt="1" loading={pending}>
                Create account
              </Button>
            </Flex>
          </form>
          <Text size="2" align="center" color="gray">
            Already have an account?{" "}
            <Link
              to="/signin"
              search={{ email: inviteEmail, invite: inviteToken }}
              style={{ color: "var(--accent-9)" }}
            >
              Sign in
            </Link>
          </Text>
        </Flex>
      </Card>
    </AuthShell>
  );
}
