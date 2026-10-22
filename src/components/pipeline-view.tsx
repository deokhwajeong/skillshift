"use client";

/**
 * The agent pipeline as a clickable diagram. Two lanes meet at the Signal Scorer:
 *   news side: Ingest -> Filter -> Shift Extraction -> Verification
 *   job side:  Ingest -> JD Analyzer
 *   both:      -> Signal Scorer -> Brief Writer
 * Clicking a stage shows a real input and output taken from this run's data.
 */
import { useState } from "react";
import type { StageSummary } from "@/pipeline/schemas";
import type { AgentTotals, StageInfo } from "@/lib/view";
import { AiLabel } from "./ai-label";

export interface StageView {
  summary: StageSummary;
  info: StageInfo;
  totals: AgentTotals | null;
  input: unknown;
  output: unknown;
}

/** Grid placement on wide screens. On a phone the stages simply stack in order. */
const PLACE: Record<string, string> = {
  ingest: "lg:col-start-1 lg:row-span-2 lg:row-start-1",
  filter: "lg:col-start-2 lg:row-start-1",
  extract: "lg:col-start-3 lg:row-start-1",
  verify: "lg:col-start-4 lg:row-start-1",
  jd: "lg:col-start-2 lg:col-span-3 lg:row-start-2",
  score: "lg:col-start-5 lg:row-span-2 lg:row-start-1",
  brief: "lg:col-start-6 lg:row-span-2 lg:row-start-1",
};

const fmt = (n: number) => n.toLocaleString("en-US");

function Json({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-paper-2 p-3 font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">
      {text ?? "(none in this run)"}
    </pre>
  );
}

export function PipelineView({ stages }: { stages: StageView[] }) {
  const [selected, setSelected] = useState(stages[1]?.summary.stage ?? stages[0]?.summary.stage);
  const current = stages.find((s) => s.summary.stage === selected) ?? stages[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden grid-cols-6 gap-3 text-[11px] font-semibold uppercase tracking-widest text-ink-3 lg:grid">
        <span />
        <span className="col-span-3 border-b border-rule pb-1">News side</span>
        <span className="col-span-2 border-b border-rule pb-1">Both sides meet</span>
      </div>
      <ol className="grid gap-3 lg:grid-cols-6 lg:grid-rows-[auto_auto]">
        {stages.map(({ summary: s, info }, i) => {
          const active = s.stage === current?.summary.stage;
          return (
            <li key={s.stage} className={`relative ${PLACE[s.stage] ?? ""}`}>
              {i > 0 && (
                <span aria-hidden className="absolute -left-3 top-1/2 hidden -translate-y-1/2 text-ink-3 lg:block">
                  {"›"}
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelected(s.stage)}
                aria-pressed={active}
                className={`flex h-full w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
                  active ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-xs ${active ? "text-paper/70" : "text-ink-3"}`}>{i + 1}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      s.usesLlm ? (active ? "bg-paper/20" : "bg-ai/15 text-ai") : active ? "bg-paper/20" : "bg-paper-2 text-ink-2"
                    }`}
                  >
                    {s.usesLlm ? "LLM" : "Code"}
                  </span>
                </span>
                <span className="font-serif text-lg font-semibold leading-tight">{s.label}</span>
                <span className="font-mono text-2xl leading-none">
                  {s.inCount} <span className={active ? "text-paper/60" : "text-ink-3"}>{"→"}</span> {s.outCount}
                </span>
                <span className={`text-xs ${active ? "text-paper/80" : "text-ink-3"}`}>
                  {info.units[0]} {"→"} {info.units[1]}
                </span>
                {s.stage === "jd" && <span className="hidden text-[11px] uppercase tracking-widest text-ink-3 lg:block">Job side</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {current && (
        <section aria-live="polite" className="rounded-md border border-rule p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl font-semibold">
              {stages.indexOf(current) + 1}. {current.summary.label}
            </h2>
            <p className="font-mono text-xs text-ink-3">
              {current.info.file}
              {current.info.prompt && <> · prompt: {current.info.prompt}</>}
            </p>
          </div>
          <p className="mt-2 max-w-3xl text-ink-2">{current.info.does}</p>
          <p className="mt-1 text-sm text-ink-3">This run: {current.summary.note}.</p>
          {current.totals && (
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-2">
              <span>{current.totals.calls} calls</span>
              <span>{fmt(current.totals.inputTokens)} input tokens</span>
              <span>{fmt(current.totals.outputTokens)} output tokens</span>
              <span>{(current.totals.ms / 1000).toFixed(1)} s summed</span>
              {current.totals.retries > 0 && <span>{current.totals.retries} retries</span>}
              {current.totals.failed > 0 && <span>{current.totals.failed} failed</span>}
            </p>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">Sample input</h3>
              <Json value={current.input} />
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
                Sample output {current.summary.usesLlm && <AiLabel agent={current.summary.label} />}
              </h3>
              <Json value={current.output} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
