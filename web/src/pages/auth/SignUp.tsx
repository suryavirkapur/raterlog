import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button, Callout, FormGroup, InputGroup } from "@blueprintjs/core";
import { ApiError, auth } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const search = useSearch({ strict: false }) as { email?: string; invite?: string };
  const invite = search.invite || "";
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(search.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Enter your name.");
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      await auth.signup({ name: name.trim(), email, password, invite_token: invite || undefined });
      if (invite) {
        navigate({ to: "/invite/$token", params: { token: invite } });
      } else {
        navigate({ to: "/app" });
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "That email already has an account — try signing in."
          : err instanceof Error
            ? err.message
            : "Sign up failed.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free plan · 3,000 events/month · no credit card."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" search={{ email, invite }}>
            Sign in
          </Link>
        </>
      }
    >
      {invite && (
        <Callout intent="primary" icon="people" style={{ marginBottom: 14 }}>
          You'll join your workspace after creating your account.
        </Callout>
      )}
      {error && (
        <Callout intent="danger" icon="error" style={{ marginBottom: 14 }}>
          {error}
        </Callout>
      )}
      <form onSubmit={submit}>
        <FormGroup label="Name" labelFor="rl-name">
          <InputGroup
            id="rl-name"
            autoComplete="name"
            placeholder="Jane Doe"
            leftIcon="person"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fill
          />
        </FormGroup>
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
        <FormGroup label="Password" labelFor="rl-password" helperText="At least 8 characters.">
          <InputGroup
            id="rl-password"
            type="password"
            autoComplete="new-password"
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
          text="Create account"
          fill
          large
          loading={busy}
          style={{ marginTop: 8 }}
        />
      </form>
      <p className="rl-auth-alt">
        By signing up you agree to fair use of the free plan.
      </p>
    </AuthLayout>
  );
}
