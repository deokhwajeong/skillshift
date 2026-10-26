/**
 * "View code" chips: each opens the exact file and line range on GitHub.
 * The ranges live in src/lib/code-links.ts.
 */
import { codeUrl, type CodeLink } from "@/lib/code-links";

/** The static portfolio copy hides "View code": the repository is private, so visitors would hit a 404. */
export const SHOW_CODE_LINKS = process.env.NEXT_PUBLIC_STATIC_DEMO !== "1";

export function CodeLinks({ title, links }: { title: string; links: CodeLink[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-3">{title}</span>
      {links.map((l) => (
        <a
          key={`${l.path}#${l.lines[0]}`}
          href={codeUrl(l)}
          target="_blank"
          rel="noreferrer"
          title={`${l.path}, lines ${l.lines[0]} to ${l.lines[1]}`}
          className="inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-0.5 hover:border-ink"
        >
          {l.label}
          <span className="font-mono text-[11px] text-ink-3">
            L{l.lines[0]}-{l.lines[1]}
          </span>
        </a>
      ))}
    </div>
  );
}
