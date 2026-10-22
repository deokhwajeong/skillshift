/**
 * Marks text written by an LLM agent. Source material (quoted excerpts)
 * never carries this label; it is shown as a quote with a link instead.
 */
export function AiLabel({ agent, className = "" }: { agent?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-ai/50 px-2 py-0.5 font-sans text-[11px] font-medium uppercase tracking-wider text-ai ${className}`}
      title={agent ? `Written by the ${agent} agent` : "Written by an AI agent"}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 fill-current">
        <path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z" />
      </svg>
      AI-generated{agent ? ` · ${agent}` : ""}
    </span>
  );
}

/** A short quote copied word for word from a source, with where it came from. */
export function SourceQuote({ text, className = "" }: { text: string; className?: string }) {
  return (
    <blockquote className={`border-l-2 border-ink pl-3 font-serif text-[15px] italic leading-snug text-ink ${className}`}>
      &ldquo;{text}&rdquo;
    </blockquote>
  );
}
