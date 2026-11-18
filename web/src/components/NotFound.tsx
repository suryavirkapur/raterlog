import { Button, NonIdealState } from "@blueprintjs/core";
import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
      <NonIdealState
        icon="path-search"
        title="Page not found"
        action={
          <Link to="/">
            <Button text="Go home" />
          </Link>
        }
      />
    </div>
  );
}
