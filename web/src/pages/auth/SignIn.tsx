import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button, Callout, FormGroup, InputGroup } from "@blueprintjs/core";
import { ApiError, auth } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const search = useSearch({ strict: false }) as { email?: string; invite?: string };
  const invite = search.invite || "";
  const navigate = useNavigate();

  const [email, setEmail] = useState(search.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      await auth.signin({ email, password, invite_token: invite || undefined });
      if (invite) {
        navigate({ to: "/invite/$token", params: { token: invite } });
      } else {
        navigate({ to: "/app" });
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Wrong email or password."
          : err instanceof Error
            ? err.message
            : "Sign in failed.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Raterlog account."
      footer={
        <>
          New to Raterlog?{" "}
          <Link to="/signup" search={{ email, invite }}>
            Create an account
          </Link>
        </>
      }
    >
      {invite && (
        <Callout intent="primary" icon="people" style={{ marginBottom: 14 }}>
          You'll join your workspace after signing in.
        </Callout>
      )}
      {error && (
        <Callout intent="danger" icon="error" style={{ marginBottom: 14 }}>
          {error}
        </Callout>
      )}
      <form onSubmit={submit}>
        <FormGroup label="Email" labelFor="rl-email">
          <InputGroup
            id="rl-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            leftIcon="envelope"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fill
          />
        </FormGroup>
        <FormGroup label="Password" labelFor="rl-password">
          <InputGroup
            id="rl-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon="lock"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fill
          />
        </FormGroup>
        <Button
          type="submit"
          intent="primary"
          text="Sign in"
          fill
          large
          loading={busy}
          style={{ marginTop: 8 }}
        />
      </form>
      <p className="rl-auth-alt">
        <Link to="/">← Back to raterlog</Link>
      </p>
    </AuthLayout>
  );
}
