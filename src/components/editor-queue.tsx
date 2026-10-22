"use client";

/**
 * Editor Queue: approve or reject each held item. Decisions live in this
 * browser (decision-store.ts); the matrix is re-scored right here with the same
 * policy and scorer code the pipeline uses. "Export decisions" downloads
 * decisions.json for the next pipeline run.
 */
import Link from "next/link";
import { useMemo } from "react";
import type { ArticleCard, EditorDecision, EditorQueueItem, SkillScore, VerifiedShift } from "@/pipeline/schemas";
import { decisionFor, decisionKey, itemKey, mergeForExport } from "@/pipeline/editorial";
import { clearAllDecisions, clearDecision, setDecision, useDecisions } from "@/lib/decision-store";
import { diffScores, rescore, type RescoreInput } from "@/lib/rescore";
import { AiLabel, SourceQuote } from "./ai-label";
import { QuadrantMarker } from "./quadrant";

export interface QueueEntry {
  shift: VerifiedShift;
  article: ArticleCard;
  items: EditorQueueItem[];
  others: { shift: VerifiedShift; article: ArticleCard }[];
}

const KIND_LABEL: Record<EditorQueueItem["kind"], string> = {
  "low-confidence": "Low confidence",
  conflict: "Conflicting claim",
  "candidate-skill": "Proposed new skill",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function EditorQueue({
  entries,
  input,
  baseline,
  names,
  fileDecisions,
}: {
  entries: QueueEntry[];
  input: RescoreInput;
  baseline: SkillScore[];
  names: Record<string, string>;
  /** Everything in data/editorial/decisions.json, including items not on this screen. */
  fileDecisions: EditorDecision[];
}) {
  const role = input.role;
  const local = useDecisions(role);
  const result = useMemo(() => rescore(input, local), [input, local]);
  // One source of truth: the decisions applyDecisions resolved (file, then this browser), by stable key.
  const effective = new Map(result.queue.map((q) => [q.id, q.decision]));
  const decisionOf = (item: EditorQueueItem) => effective.get(item.id);
  const localByKey = new Map(local.map((d) => [decisionKey(d), d]));
  const localOf = (item: EditorQueueItem, shift: VerifiedShift) => localByKey.get(itemKey(item, shift));
  const changes = diffScores(baseline, result.scores);
  const all = entries.flatMap((e) => e.items);
  const counts = {
    pending: all.filter((i) => !decisionOf(i)).length,
    approve: all.filter((i) => decisionOf(i) === "approve").length,
    reject: all.filter((i) => decisionOf(i) === "reject").length,
  };

  const exportDecisions = () => {
    const decided = mergeForExport(fileDecisions, local);
    const blob = new Blob([JSON.stringify({ version: 1, decisions: decided }, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "decisions.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <ol className="flex flex-col gap-6">
        {entries.length === 0 && <li className="text-ink-2">Nothing is waiting. Every extracted shift passed the policy.</li>}
        {entries.map(({ shift, article, items, others }) => {
          const counted = result.shifts.find((s) => s.id === shift.id)?.status === "published";
          return (
            <li key={shift.id} className="rounded-md border border-rule p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-3">
                  {article.source} · {article.publishedDate}
                </p>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${counted ? "text-emerging-ink" : "text-ink-3"}`}>
                  {counted ? "Counts toward the matrix" : "Not counted"}
                </span>
              </div>
              <a href={article.url} target="_blank" rel="noreferrer" className="mt-1 block font-serif text-xl font-semibold leading-snug hover:underline">
                {article.title}
              </a>
              <SourceQuote text={shift.excerpt} className="mt-3" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AiLabel agent="Shift Extraction" />
                <span className="text-xs text-ink-3">
                  confidence {shift.confidence.toFixed(2)} · {shift.verification.evidenceLevel} evidence · skills:{" "}
                  {shift.skillIds.map((id) => names[id] ?? id).join(", ") || "none"}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-2">{shift.summary}</p>

              {others.map((o) => (
                <div key={o.shift.id} className="mt-3 rounded-md bg-paper-2 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">The other side</p>
                  <p className="mt-1 text-sm font-semibold">{o.article.title}</p>
                  <SourceQuote text={o.shift.excerpt} className="mt-1" />
                </div>
              ))}

              <ul className="mt-4 flex flex-col gap-3 border-t border-rule pt-3">
                {items.map((item) => {
                  const d = decisionOf(item);
                  const fromFile = !localOf(item, shift) && item.decision;
                  // Undo returns the item to pending. A decision from decisions.json needs an explicit
                  // local "pending" override; a decision made here is simply forgotten.
                  const undo = () =>
                    item.decision
                      ? setDecision(role, { ...decisionFor(item, shift, "approve", new Date().toISOString()), decision: "pending" })
                      : clearDecision(role, { articleId: shift.articleId, kind: item.kind, excerpt: shift.excerpt });
                  return (
                    <li key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="text-sm">
                        <span className="font-semibold">{KIND_LABEL[item.kind]}. </span>
                        <span className="text-ink-2">{item.reason}</span>
                        {item.kind === "candidate-skill" && (
                          <span className="block text-xs text-ink-3">
                            Approving records the decision; the skill is tracked once it is added to config/taxonomy.json.
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {d ? (
                          <>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                                d === "approve" ? "bg-emerging-ink text-paper" : "bg-ink-3 text-paper"
                              }`}
                            >
                              {d === "approve" ? "Approved" : "Rejected"}
                              {fromFile ? " (file)" : ""}
                            </span>
                            <button type="button" onClick={undo} className="text-xs text-ink-2 underline hover:text-ink">
                              Undo
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setDecision(role, decisionFor(item, shift, "approve", new Date().toISOString()))}
                              className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-paper hover:opacity-85"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setDecision(role, decisionFor(item, shift, "reject", new Date().toISOString()))}
                              className="rounded-full border border-rule px-3 py-1 text-sm font-semibold hover:border-ink"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Pending", counts.pending],
              ["Approved", counts.approve],
              ["Rejected", counts.reject],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-md bg-paper-2 py-2">
              <dd className="font-mono text-2xl">{v}</dd>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{k}</dt>
            </div>
          ))}
        </dl>

        <section aria-labelledby="impact-title" className="rounded-md border border-rule p-4">
          <h2 id="impact-title" className="font-serif text-lg font-semibold">
            Effect on the matrix
          </h2>
          {changes.length === 0 ? (
            <p className="mt-1 text-sm text-ink-3">No score changes yet. Approve a held shift to see its effect.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {changes.map((c) => (
                <li key={c.skillId}>
                  <Link href={`/${role}/skills/${c.skillId}`} className="font-semibold hover:underline">
                    {names[c.skillId] ?? c.skillId}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-ink-2">
                    <QuadrantMarker quadrant={c.before.quadrant} /> {c.before.quadrant} {"→"} <QuadrantMarker quadrant={c.after.quadrant} />{" "}
                    {c.after.quadrant}
                  </span>
                  <span className="font-mono text-xs text-ink-3">
                    news {c.before.newsSignal.toFixed(2)} {"→"} {c.after.newsSignal.toFixed(2)} · JD {pct(c.after.jdSignal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-3">Re-scored in your browser with the same Signal Scorer code. No LLM involved.</p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <button
            type="button"
            onClick={exportDecisions}
            className="rounded-full bg-ink px-4 py-2 font-semibold text-paper hover:opacity-85"
          >
            Export decisions
          </button>
          <p className="text-xs text-ink-3">
            Save the file as <code className="font-mono">data/editorial/decisions.json</code> and run{" "}
            <code className="font-mono">npm run pipeline</code>. The pipeline applies the same decisions, and the brief is
            rewritten with them.
          </p>
          {local.length > 0 && (
            <button type="button" onClick={() => clearAllDecisions(role)} className="self-start text-xs text-ink-2 underline hover:text-ink">
              Reset this browser&rsquo;s decisions
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
