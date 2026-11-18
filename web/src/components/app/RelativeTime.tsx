import { useEffect, useReducer } from "react";
import { Tooltip } from "@blueprintjs/core";
import { absTime, relTime } from "./util";

/** "5m ago" with the absolute timestamp in a tooltip. Refreshes every 30s. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <Tooltip content={absTime(iso)} placement="top" hoverOpenDelay={200}>
      <span className={className}>{relTime(iso)}</span>
    </Tooltip>
  );
}
