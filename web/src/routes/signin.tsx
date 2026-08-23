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
import { getAuth, loginFn } from "@/server/auth";
import AuthShell from "@/components/AuthShell";

export const Route = createFileRoute("/signin")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    invite: typeof search.invite === "string" ? search.invite : "",
  }),
  beforeLoad: async ({ search }) => {
    const { user } = await getAuth();
    if (user) {
      if (search.invite) {
        throw redirect({ to: "/invite/$token", params: { token: search.invite } });
      }
      throw redirect({ to: "/dash" });
    }
  },
  component: SigninPage,
});

function SigninPage() {
  const { email: inviteEmail, invite: inviteToken } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await loginFn({
      data: {
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        inviteToken: inviteToken || undefined,
      },
    });
    setPending(false);
    if (res?.error) setError(res.error);
    else if (res?.redirect) window.location.assign(res.redirect);
  }

  return (
    <AuthShell>
      <Card size="3" style={{ width: "100%", maxWidth: "420px" }}>
        <Flex direction="column" gap="5">
          <Box>
            <Heading size="6" mb="1">
              Welcome back
            </Heading>
            <Text size="2" color="gray">
              Sign in to your account
            </Text>
          </Box>
          {inviteToken && (
            <Callout.Root color="blue" size="1">
              <Callout.Text>Sign in to accept your team invitation.</Callout.Text>
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
                  placeholder="Your password"
                  size="3"
                />
              </label>
              <Button type="submit" size="3" mt="1" loading={pending}>
                Sign in
              </Button>
            </Flex>
          </form>
          <Text size="2" align="center" color="gray">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              search={{ email: inviteEmail, invite: inviteToken }}
              style={{ color: "var(--accent-9)" }}
            >
              Sign up
            </Link>
          </Text>
        </Flex>
      </Card>
    </AuthShell>
  );
}
