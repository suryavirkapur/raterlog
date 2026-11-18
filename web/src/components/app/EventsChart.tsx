import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/api";
import { CHART, CHART_TOOLTIP_STYLE } from "./chartTheme";
import { fmtNum } from "./util";

/** The "events over time" area chart. Sized by its parent — give it a height. */
export function EventsChart({ data, hourly }: { data: SeriesPoint[]; hourly?: boolean }) {
  const tickFmt = (t: string) => {
    const d = new Date(t);
    return hourly
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={tickFmt}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke={CHART.tick}
          minTickGap={40}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke={CHART.tick}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelFormatter={(v) => new Date(v as string).toLocaleString()}
          formatter={(v) => [fmtNum(Number(v)), "events"]}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={CHART.primary}
          strokeWidth={2}
          fill={CHART.primarySoft}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
