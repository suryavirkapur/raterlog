import type { BreakdownRow } from "@/lib/api";
import { fmtNum } from "./util";

/** One row of a "top N" breakdown: key, proportional bar, count. */
export function BreakdownBar({
  row,
  max,
  onPick,
}: {
  row: BreakdownRow;
  max: number;
  onPick?: (key: string) => void;
}) {
  return (
    <div
      className="rl-bar-row"
      style={onPick ? { cursor: "pointer" } : undefined}
      onClick={onPick ? () => onPick(row.key) : undefined}
      title={onPick ? `Filter chart to "${row.key}"` : row.key}
    >
      <div className="rl-bar-key">{row.key}</div>
      <div className="rl-bar-track">
        <div className="rl-bar-fill" style={{ width: `${Math.max((row.count / Math.max(max, 1)) * 100, 2)}%` }} />
      </div>
      <div className="rl-bar-count">{fmtNum(row.count)}</div>
    </div>
  );
}
