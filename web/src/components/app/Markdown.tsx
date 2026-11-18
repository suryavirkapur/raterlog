// Tiny safe markdown renderer: **bold**, `code`, [links](url), bare URLs and
// line breaks. Renders plain React nodes — never dangerouslySetInnerHTML.
import { Fragment, memo, type ReactNode } from "react";

type Seg =
  | { kind: "text" | "bold" | "code"; text: string }
  | { kind: "link"; text: string; href: string };

const INLINE =
  /\[([^\]]*)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(https?:\/\/[^\s<>"'()[\]]+)/g;

function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url) ? url : null;
}

function parseLine(line: string): Seg[] {
  const segs: Seg[] = [];
  let last = 0;
  INLINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(line)) !== null) {
    if (m.index > last) segs.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1] !== undefined) {
      const href = safeHref(m[2] ?? "");
      if (href) segs.push({ kind: "link", text: m[1] || href, href });
      else segs.push({ kind: "text", text: m[0] });
    } else if (m[3] !== undefined) {
      segs.push({ kind: "bold", text: m[3] });
    } else if (m[4] !== undefined) {
      segs.push({ kind: "code", text: m[4] });
    } else if (m[5] !== undefined) {
      // Trim trailing punctuation commonly stuck to bare URLs.
      const url = m[5].replace(/[.,;:!?]+$/, "");
      const trail = m[5].slice(url.length);
      segs.push({ kind: "link", text: url, href: url });
      if (trail) segs.push({ kind: "text", text: trail });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push({ kind: "text", text: line.slice(last) });
  return segs;
}

function renderSeg(seg: Seg, i: number): ReactNode {
  switch (seg.kind) {
    case "bold":
      return <strong key={i}>{seg.text}</strong>;
    case "code":
      return (
        <code key={i} className="rl-code">
          {seg.text}
        </code>
      );
    case "link":
      return (
        <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {seg.text}
        </a>
      );
    default:
      return <Fragment key={i}>{seg.text}</Fragment>;
  }
}

export const Markdown = memo(function Markdown({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <span className={className}>
      {text.split(/\r?\n/).map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {parseLine(line).map(renderSeg)}
        </Fragment>
      ))}
    </span>
  );
});
