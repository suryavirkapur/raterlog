import type { ReactNode } from "react";
import { Card, Classes, type IconName } from "@blueprintjs/core";
import { Icon } from "@blueprintjs/core";
import { fmtNum } from "./util";

/** KPI tile used on Analytics / journey pages. */
export function StatTile({
  icon,
  label,
  value,
  sub,
  delta,
  loading,
}: {
  icon?: IconName;
  label: ReactNode;
  value?: number | string | ReactNode;
  sub?: ReactNode;
  /** Signed % change, e.g. 12.5 renders "▲ +13% vs yesterday". */
  delta?: { pct: number; against: string };
  loading?: boolean;
}) {
  let deltaNode: ReactNode = null;
  if (delta && Number.isFinite(delta.pct)) {
    const up = delta.pct >= 0;
    deltaNode = (
      <span className={`rl-stat-delta ${up ? "up" : "down"}`}>
        {up ? "▲" : "▼"} {up ? "+" : ""}
        {Math.abs(delta.pct).toFixed(0)}% {delta.against}
      </span>
    );
  }
  return (
    <Card compact>
      <div className="rl-stat-label">
        {icon && <Icon icon={icon} size={12} />}
        {label}
      </div>
      <div className={`rl-stat-value ${typeof value === "string" ? "rl-stat-value-text" : ""} ${loading ? Classes.SKELETON : ""}`}>
        {value == null ? "—" : typeof value === "number" ? fmtNum(value) : value}
      </div>
      {(sub || deltaNode) && (
        <div className="rl-stat-sub">
          {deltaNode} {sub}
        </div>
      )}
    </Card>
  );
}
