import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@blueprintjs/core";
import { applyTheme, getTheme } from "@/lib/theme";

const AUTH_SEARCH = { email: "", invite: "" };

/** Sticky top navigation shared by all public pages. */
export function MarketingNav() {
  const [theme, setTheme] = useState(getTheme);
  return (
    <header className="rl-nav">
      <div className="rl-nav-in">
        <Link to="/" className="rl-brand" aria-label="Raterlog home">
          <img src="/icon.png" alt="" width={28} height={28} />
          <span>Raterlog</span>
        </Link>
        <nav className="rl-nav-links" aria-label="Site">
          <Link to="/docs" className="rl-nav-link">
            Docs
          </Link>
          <Link to="/docs/agents" className="rl-nav-link">
            AI agents
          </Link>
          <Link to="/pricing" className="rl-nav-link">
            Pricing
          </Link>
        </nav>
        <div className="rl-nav-actions">
          <Button
            minimal
            icon="contrast"
            aria-label="Toggle theme"
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              applyTheme(next);
              setTheme(next);
            }}
          />
          <Link to="/signin" search={AUTH_SEARCH}>
            <Button minimal text="Sign in" />
          </Link>
          <Link to="/signup" search={AUTH_SEARCH}>
            <Button intent="primary" text="Start free" />
          </Link>
        </div>
      </div>
    </header>
  );
}
