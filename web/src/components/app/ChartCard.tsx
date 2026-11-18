import type { ReactNode } from "react";
import { Card, Classes, NonIdealState } from "@blueprintjs/core";

/** Card wrapper for charts/tables with a title row, loading skeleton and error state. */
export function ChartCard({
  title,
  right,
  height = 260,
  loading,
  error,
  empty,
  children,
}: {
  title: ReactNode;
  right?: ReactNode;
  height?: number;
  loading?: boolean;
  error?: string | null;
  /** Shown when not loading and `empty` is true. */
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <Card compact>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {right}
      </div>
      {error ? (
        <NonIdealState icon="error" title="Couldn't load data" description={error} layout="horizontal" />
      ) : loading ? (
        <div className={Classes.SKELETON} style={{ height, borderRadius: 6 }} />
      ) : empty ? (
        <NonIdealState icon="pulse" title="No data for this range" layout="horizontal" />
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </Card>
  );
}
