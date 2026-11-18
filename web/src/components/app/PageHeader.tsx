import type { ReactNode } from "react";
import "./app.css";

/** Consistent page header for all /app/$projectId pages. */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rl-page-header">
      <div style={{ minWidth: 0 }}>
        <h2 className="rl-page-title">
          {icon}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        </h2>
        {subtitle != null && <div className="rl-page-sub">{subtitle}</div>}
      </div>
      {actions != null && <div className="rl-page-actions">{actions}</div>}
    </div>
  );
}
