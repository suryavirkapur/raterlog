import { Link } from "@tanstack/react-router";

const AUTH_SEARCH = { email: "", invite: "" };

/** Shared footer for public pages. */
export function MarketingFooter() {
  return (
    <footer className="rl-footer">
      <div className="rl-footer-in">
        <div className="rl-footer-brand">
          <img src="/icon.png" alt="" width={24} height={24} />
          <span>Raterlog</span>
        </div>
        <nav className="rl-footer-links" aria-label="Footer">
          <Link to="/docs" className="rl-footer-link">
            Docs
          </Link>
          <Link to="/pricing" className="rl-footer-link">
            Pricing
          </Link>
          <Link to="/signin" search={AUTH_SEARCH} className="rl-footer-link">
            Sign in
          </Link>
          <Link to="/signup" search={AUTH_SEARCH} className="rl-footer-link">
            Sign up
          </Link>
        </nav>
        <span className="rl-footer-copy">© {new Date().getFullYear()} Raterlog</span>
      </div>
    </footer>
  );
}
