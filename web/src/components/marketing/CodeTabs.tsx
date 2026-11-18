import { useState } from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import { CodeBlock } from "./CodeBlock";

export type CodeTab = { id: string; label: string; code: string };

/** Tabbed code snippets (curl / JavaScript / Python). */
export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [cur, setCur] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === cur) ?? tabs[0];
  if (!active) return null;
  return (
    <div>
      <ButtonGroup minimal style={{ marginBottom: 8 }}>
        {tabs.map((t) => (
          <Button key={t.id} small active={t.id === active.id} onClick={() => setCur(t.id)} text={t.label} />
        ))}
      </ButtonGroup>
      <CodeBlock code={active.code} label={active.label} />
    </div>
  );
}
