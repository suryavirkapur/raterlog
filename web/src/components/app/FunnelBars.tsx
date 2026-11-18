import type { FunnelStep } from "@/lib/api";
import { fmtNum } from "./util";

/** Conversion funnel rendered as shrinking bars with per-step drop-off. */
export function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const first = steps[0]?.count ?? 0;
  return (
    <div>
      {steps.map((s, i) => {
        const pct = first > 0 ? (s.count / first) * 100 : 0;
        const prev = i > 0 ? steps[i - 1]!.count : null;
        const drop = prev != null && prev > 0 ? ((prev - s.count) / prev) * 100 : 0;
        return (
          <div key={i} className="rl-funnel-step">
            {i > 0 && (
              <div className="rl-funnel-meta">
                <span>↓ {drop.toFixed(1)}% dropped off</span>
              </div>
            )}
            <div className="rl-funnel-bar" style={{ width: `${Math.max(pct, 8)}%` }}>
              {s.event}
            </div>
            <div className="rl-funnel-meta">
              <span>
                {fmtNum(s.count)} · {pct.toFixed(1)}% of first step
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
