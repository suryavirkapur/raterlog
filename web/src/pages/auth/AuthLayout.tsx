import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@blueprintjs/core";
import "./auth.css";

/** Centered card layout for sign-in, sign-up and invite pages. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rl-auth">
      <div className="rl-auth-box">
        <Card className="rl-auth-card" elevation={2}>
          <Link to="/" className="rl-auth-brand" aria-label="Raterlog home">
            <img src="/icon.png" alt="" width={30} height={30} />
            <span>Raterlog</span>
          </Link>
          <h1 className="rl-auth-title">{title}</h1>
          {subtitle != null && <p className="rl-auth-sub">{subtitle}</p>}
          {children}
        </Card>
        {footer != null && <div className="rl-auth-footer">{footer}</div>}
      </div>
    </div>
  );
}
