import { SegmentedControl } from "@blueprintjs/core";
import type { Range } from "@/lib/api";

const OPTIONS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

export function RangeSelect({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <SegmentedControl
      size="small"
      options={OPTIONS}
      value={value}
      onValueChange={(v) => onChange(v as Range)}
    />
  );
}
