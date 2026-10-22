import type { BriefItem } from "@/pipeline/schemas";
import { briefSources, formatDate, splitCitations, type Source } from "@/lib/view";
import type { RoleData } from "@/lib/data";
import Link from "next/link";

/** A sentence with its [source-id] markers turned into numbered footnote links. */
function Cited({ text, sources, itemIndex }: { text: string; sources: Source[]; itemIndex: number }) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return (
    <>
      {splitCitations(text).map((part, i) => {
        if ("text" in part) return <span key={i}>{part.text}</span>;
        const s = byId.get(part.cite);
        if (!s) return null;
        return (
          <sup key={i} className="ml-0.5">
            <a
              href={`#src-${itemIndex}-${s.n}`}
              title={`${s.title} (${s.by})`}
              className="font-mono text-[10px] font-semibold text-accent hover:underline"
            >
              [{s.n}]
            </a>
          </sup>
        );
      })}
    </>
  );
}

export function BriefCard({ item, index, data }: { item: BriefItem; index: number; data: RoleData }) {
  const sources = briefSources(item, data);
  const skills = item.skillIds.map((id) => data.skills.get(id)).filter((s) => s !== undefined);
  return (
    <article id={`brief-item-${index}`} className="flex flex-col gap-3 border-t-2 border-rule-strong pt-3">
      <div className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
        <span>No. {index + 1}</span>
        {skills.map((s) => (
          <Link key={s.id} href={`/${data.role.id}/skills/${s.id}`} className="truncate text-accent hover:underline">
            {s.name}
          </Link>
        ))}
      </div>
      <h3 className="font-serif text-2xl leading-tight font-semibold">{item.headline}</h3>

      <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">What changed</h4>
          <p>
            <Cited text={item.whatChanged} sources={sources} itemIndex={index} />
          </p>
        </section>
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">Why it matters for this role</h4>
          <p>
            <Cited text={item.whyItMatters} sources={sources} itemIndex={index} />
          </p>
        </section>
        <section className="rounded-md bg-paper-2 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">What to do this week</h4>
          <dl className="mt-1.5 space-y-1.5 text-sm">
            <div>
              <dt className="inline font-semibold text-ink">Learn: </dt>
              <dd className="inline">{item.whatToDo.learn}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">Resume angle: </dt>
              <dd className="inline">{item.whatToDo.resumeAngle}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">Prepare to answer: </dt>
              <dd className="inline italic">&ldquo;{item.whatToDo.interviewQuestion}&rdquo;</dd>
            </div>
          </dl>
        </section>
      </div>

      <ol className="mt-auto space-y-1 border-t border-rule pt-2 text-xs text-ink-3">
        {sources.map((s) => (
          <li key={s.id} id={`src-${index}-${s.n}`} className="flex gap-1.5">
            <span className="font-mono text-accent">[{s.n}]</span>
            <span>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-ink-2 underline decoration-rule hover:decoration-ink">
                {s.title}
              </a>
              {", "}
              {s.by}, {formatDate(s.date, "short")}
              <span className="ml-1 uppercase tracking-wider">{s.kind === "jd" ? "job posting" : "news"}</span>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
