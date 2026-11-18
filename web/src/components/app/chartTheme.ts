// Recharts colors wired to Blueprint design tokens (theme-aware via CSS vars).
export const CHART = {
  primary: "var(--bp-intent-primary-rest, #2d72d2)",
  primarySoft: "rgba(56, 111, 217, 0.18)",
  grid: "var(--bp-surface-border-color-default, rgba(120,134,156,0.3))",
  tick: "var(--bp-typography-color-muted, #738091)",
  success: "var(--bp-intent-success-rest, #32a467)",
  danger: "var(--bp-intent-danger-rest, #d33f49)",
  warning: "var(--bp-intent-warning-rest, #c87619)",
};

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--bp-surface-background-color-default-rest, #1c2127)",
  border: "1px solid var(--bp-surface-border-color-default, rgba(120,134,156,0.35))",
  borderRadius: 6,
  fontSize: 12,
  padding: "6px 10px",
};
