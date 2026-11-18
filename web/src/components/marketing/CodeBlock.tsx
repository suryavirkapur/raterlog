import { useState } from "react";
import { Button } from "@blueprintjs/core";
import { toast } from "@/lib/toaster";

/** Copy text to the clipboard, with a fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}

/** Monospace code block with a header row and copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rl-code">
      <div className="rl-code-head">
        <span className="rl-code-label">{label ?? "code"}</span>
        <Button
          small
          minimal
          icon={copied ? "tick" : "duplicate"}
          text={copied ? "Copied" : "Copy"}
          onClick={async () => {
            if (await copyText(code)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } else {
              toast({ message: "Couldn't copy to clipboard", intent: "warning" });
            }
          }}
        />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
