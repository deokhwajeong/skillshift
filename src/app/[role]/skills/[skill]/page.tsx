import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel, SourceQuote } from "@/components/ai-label";
import { LocalDecisionsNotice } from "@/components/local-decisions-notice";
import { QuadrantBadge } from "@/components/quadrant";
import { getRoles, getScoringConfig, loadRoleData } from "@/lib/data";
import type { RescoreInput } from "@/lib/rescore";
import { formatDate, skillEvidence } from "@/lib/view";
import { explainScore } from "@/scoring/signal-scorer";
import type { EvidenceLevel } from "@/pipeline/schemas";

/** One static page per scored skill, per role that has data. Anything else is a 404. */
export function generateStaticParams() {
  return getRoles().flatMap((r) => {
    const data = loadRoleData(r.id);
    return data ? data.scores.map((s) => ({ role: r.id, skill: s.skillId })) : [];
  });
}

const SOURCE_TYPE_LABEL = { primary: "Primary source", trade: "Trade press", blog: "Blog" } as const;

function EvidenceChip({ level }: { level: EvidenceLevel }) {
  const dots = { Strong: 3, Moderate: 2, Weak: 1 }[level];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-2">
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i <= dots ? "bg-ink" : "border border-ink-3"}`} />
        ))}
      </span>
      {level} evidence
    </span>
  );
}

/** A 0..1 bar with the "strong" threshold marked, or a -1..1 bar centered on 0 for momentum. */
function ScoreBar({ value, threshold, diverging = false }: { value: number; threshold?: number; diverging?: boolean }) {
  const left = diverging ? (Math.min(value, 0) + 1) * 50 : 0;
  const width = diverging ? Math.abs(value) * 50 : value * 100;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-paper-2" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-ink" style={{ left: `${left}%`, width: `${width}%` }} />
      {threshold !== undefined && (
        <div className="absolute -inset-y-1 w-0.5 bg-accent" style={{ left: `${threshold * 100}%` }} title="Strong threshold" />
      )}
      {diverging && <div className="absolute -inset-y-1 left-1/2 w-px bg-ink-3" />}
    </div>
  );
}

export default async function SkillPage({ params }: PageProps<"/[role]/skills/[skill]">) {
  const { role: roleId, skill: skillId } = await params;
  const data = loadRoleData(roleId);
  const score = data?.scores.find((s) => s.skillId === skillId);
  const skill = data?.skills.get(skillId);
  if (!data || !score || !skill) notFound();

  const config = getScoringConfig();
  const [newsLine, jdLine, momentumLine, whyLine] = explainScore(score, config);
  const ev = skillEvidence(data, skillId);
  const rescoreInput: RescoreInput = {
    role: roleId,
    skills: [...data.skills.values()],
    shifts: data.shifts,
    queue: data.queue,
    articles: data.articles,
    jdMentions: data.jdMentions,
    analyzedJdCount: data.summary.analyzedJdIds.length,
    config,
  };
  const t = config.thresholds;

  const rows = [
    { name: "News signal", value: score.newsSignal.toFixed(2), bar: <ScoreBar value={score.newsSignal} threshold={t.newsStrong} />, line: newsLine },
    { name: "JD signal", value: `${Math.round(score.jdSignal * 100)}%`, bar: <ScoreBar value={score.jdSignal} threshold={t.jdStrong} />, line: jdLine },
    {
      name: "Momentum",
      value: `${score.momentum >= 0 ? "+" : ""}${score.momentum.toFixed(2)}`,
      bar: <ScoreBar value={score.momentum} diverging />,
      line: momentumLine,
    },
  ];

  return (
    <article className="flex flex-col gap-10">
      <div>
        <Link href={`/${roleId}`} className="text-sm text-ink-2 hover:text-ink">
          {"←"} Back to the matrix
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QuadrantBadge quadrant={score.quadrant} />
          {ev.overall && <EvidenceChip level={ev.overall} />}
        </div>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-6xl">{skill.name}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">{skill.description}</p>
        {skill.aliases.length > 0 && <p className="mt-2 text-sm text-ink-3">Also called: {skill.aliases.join(", ")}</p>}
      </div>

      <LocalDecisionsNotice input={rescoreInput} skillId={skillId} baseline={score} />

      <section aria-labelledby="scores-title" className="grid gap-6 border-y border-rule py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <h2 id="scores-title" className="text-xs font-semibold uppercase tracking-widest text-ink-3">
            How the score was computed
          </h2>
          <dl className="mt-4 flex flex-col gap-5">
            {rows.map((r) => (
              <div key={r.name} className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
                <dt>
                  <span className="block text-sm font-semibold">{r.name}</span>
                  <span className="font-mono text-2xl">{r.value}</span>
                </dt>
                <dd className="flex flex-col gap-2 pt-1">
                  {r.bar}
                  <p className="text-sm text-ink-2">{r.line}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="flex flex-col gap-4 rounded-md bg-paper-2 p-5">
          <p className="font-serif text-xl leading-snug">{whyLine}</p>
          <p className="text-xs text-ink-3">
            Computed by code (the Signal Scorer, <code className="font-mono">src/scoring/signal-scorer.ts</code>) with the
            thresholds in <code className="font-mono">config/scoring.json</code>. No LLM decides the quadrant.
          </p>
          <div className="border-t border-rule pt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Evidence level</p>
            <p className="mt-1 text-sm text-ink-2">
              {ev.news.length === 0
                ? "No verified news mentions this skill. The score rests on job postings only."
                : (["Strong", "Moderate", "Weak"] as const)
                    .filter((l) => ev.levels[l] > 0)
                    .map((l) => `${ev.levels[l]} ${l}`)
                    .join(", ") + ` across ${ev.news.length} verified shift(s). Set by the Verification agent.`}
            </p>
          </div>
        </aside>
      </section>

      {ev.conflicts.length > 0 && (
        <section aria-labelledby="conflicts-title" className="rounded-md border-2 border-accent p-5">
          <h2 id="conflicts-title" className="font-serif text-2xl font-semibold">
            Conflicting claims
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Sources disagree. The flagged claim waits for an editor and does not count toward the score until approved.
          </p>
          {ev.conflicts.map((c) => (
            <div key={c.shift.id} className="mt-4 grid gap-4 sm:grid-cols-2">
              {[{ shift: c.shift, article: c.article }, ...c.other].map((e) => (
                <div key={e.shift.id} className="rounded-md bg-paper-2 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                    {e.shift.status === "queued" ? "Held for an editor" : "Published, counts"}
                  </p>
                  <a href={e.article.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold leading-snug hover:underline">
                    {e.article.title}
                  </a>
                  <p className="text-xs text-ink-3">
                    {e.article.source}, {formatDate(e.article.publishedDate, "short")}
                  </p>
                  <SourceQuote text={e.shift.excerpt} className="mt-2" />
                  <p className="mt-2 text-sm text-ink-2">{e.shift.summary}</p>
                </div>
              ))}
              <p className="text-sm text-ink-2 sm:col-span-2">
                <AiLabel agent="Verification" className="mr-2" />
                {c.reason}
              </p>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="news-title">
          <h2 id="news-title" className="border-b-2 border-rule-strong pb-1 font-serif text-2xl font-semibold">
            In the news <span className="font-mono text-base text-ink-3">{ev.news.length}</span>
          </h2>
          {ev.news.length === 0 && <p className="mt-3 text-sm text-ink-3">No verified article mentions this skill yet.</p>}
          <ul className="mt-2 divide-y divide-rule">
            {ev.news.map(({ shift, article }) => (
              <li key={shift.id} className="py-4">
                <a href={article.url} target="_blank" rel="noreferrer" className="font-serif text-lg font-semibold leading-snug hover:underline">
                  {article.title}
                </a>
                <p className="mt-0.5 text-xs text-ink-3">
                  {article.source} · {SOURCE_TYPE_LABEL[article.sourceType]} · {formatDate(article.publishedDate, "short")}
                </p>
                <SourceQuote text={shift.excerpt} className="mt-3" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <EvidenceChip level={shift.verification.evidenceLevel} />
                  <AiLabel agent="Shift Extraction" />
                </div>
                <p className="mt-1.5 text-sm text-ink-2">{shift.summary}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="jd-title">
          <h2 id="jd-title" className="border-b-2 border-rule-strong pb-1 font-serif text-2xl font-semibold">
            In job postings <span className="font-mono text-base text-ink-3">{ev.jd.length}</span>
          </h2>
          {ev.jd.length === 0 && <p className="mt-3 text-sm text-ink-3">No analyzed job posting asks for this skill.</p>}
          <ul className="mt-2 divide-y divide-rule">
            {ev.jd.map(({ mention, jd }) => (
              <li key={jd.id} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <a href={jd.url} target="_blank" rel="noreferrer" className="font-semibold leading-snug hover:underline">
                    {jd.company}
                  </a>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                      mention.requirement === "required" ? "bg-ink text-paper" : "border border-rule text-ink-2"
                    }`}
                  >
                    {mention.requirement}
                  </span>
                </div>
                <p className="text-xs text-ink-3">
                  {jd.title} · {jd.level} · captured {formatDate(jd.capturedDate, "short")}
                </p>
                <SourceQuote text={mention.excerpt} className="mt-2" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {ev.pending.length > 0 && (
        <section aria-labelledby="pending-title" className="border-t border-rule pt-6">
          <h2 id="pending-title" className="text-xs font-semibold uppercase tracking-widest text-ink-3">
            Waiting for an editor (not counted yet)
          </h2>
          <ul className="mt-3 space-y-3">
            {ev.pending.map((p) => (
              <li key={p.shift.id} className="text-sm text-ink-2">
                <span className="font-semibold text-ink">{p.article.title}</span>: {p.shift.summary}
                <ul className="mt-1 list-disc pl-5 text-xs text-ink-3">
                  {p.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
