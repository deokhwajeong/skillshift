import type { EvalReport } from "@/pipeline/schemas";

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

/** Precision and recall from npm run eval, so the pitch can quote a measured number. */
export function EvalPanel({ report, stale }: { report: EvalReport | null; stale: boolean }) {
  if (!report) {
    return (
      <p className="mt-3 text-sm text-ink-2">
        Not measured yet. Label items in <code className="font-mono">data/eval/</code> and run{" "}
        <code className="font-mono">npm run eval</code>.
      </p>
    );
  }
  const sx = report.shiftExtraction;
  const jd = report.jdAnalyzer;
  const cards = [
    {
      name: "Shift Extraction",
      n: `${sx.articles} articles`,
      precision: sx.precision,
      recall: sx.recall,
      extra: sx.skippedDropped.length ? `${sx.skippedDropped.length} labeled article(s) skipped: the Filter dropped them` : null,
    },
    {
      name: "JD Analyzer",
      n: `${jd.jds} postings`,
      precision: jd.precision,
      recall: jd.recall,
      extra: `Required vs preferred right ${pct(jd.requirementAccuracy)} of the time`,
    },
  ];
  return (
    <div className="mt-4 flex flex-col gap-4">
      {(report.mode === "sample" || stale) && (
        <p className="rounded-md border border-sample px-3 py-2 text-sm">
          {report.mode === "sample" && <strong>SAMPLE labels on SAMPLE data: these numbers only show how the eval works. </strong>}
          {stale && "These numbers are from before the latest pipeline run. Run npm run eval again."}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.name} className="rounded-md border border-rule p-4">
            <p className="flex items-baseline justify-between">
              <span className="font-serif text-lg font-semibold">{c.name}</span>
              <span className="text-xs text-ink-3">{c.n}, hand-labeled</span>
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-widest text-ink-3">Precision</dt>
                <dd className="font-mono text-3xl">{pct(c.precision)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-widest text-ink-3">Recall</dt>
                <dd className="font-mono text-3xl">{pct(c.recall)}</dd>
              </div>
            </dl>
            {c.extra && <p className="mt-2 text-xs text-ink-3">{c.extra}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-3">
        Compared per (item, skill) pair. Precision: of the skills the agent found, how many a human also labeled.
        Recall: of the skills a human labeled, how many the agent found.
      </p>
      {sx.errors.length + jd.errors.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">Where the agents and the labels disagree ({sx.errors.length + jd.errors.length})</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-ink-2">
            {[...sx.errors, ...jd.errors].map((e) => (
              <li key={e.itemId}>
                {e.itemId}: {e.missed.length > 0 && `missed ${e.missed.join(", ")}`}
                {e.missed.length > 0 && e.extra.length > 0 && "; "}
                {e.extra.length > 0 && `extra ${e.extra.join(", ")}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
