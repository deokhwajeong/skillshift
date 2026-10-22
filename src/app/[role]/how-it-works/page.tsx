import { notFound } from "next/navigation";
import { EvalPanel } from "@/components/eval-panel";
import { ExpansionPanel } from "@/components/expansion-panel";
import { PipelineView, type StageView } from "@/components/pipeline-view";
import { getRoles, getScoringConfig, loadRoleData } from "@/lib/data";
import { loadTaxonomy } from "@/pipeline/loaders";
import { formatDate, runTotals, STAGE_INFO, stageSample } from "@/lib/view";

const fmt = (n: number) => n.toLocaleString("en-US");

/** How it works: the 7 stages with this run's counts, samples, and the cost and latency log. */
export default async function HowItWorksPage({ params }: PageProps<"/[role]/how-it-works">) {
  const { role: roleId } = await params;
  const roles = getRoles();
  const role = roles.find((r) => r.id === roleId);
  if (!role) notFound();
  const data = loadRoleData(roleId);
  if (!data) {
    const skillCount = loadTaxonomy().skills.filter((s) => s.roles.includes(roleId)).length;
    return <ExpansionPanel role={role} roles={roles} skillCount={skillCount} />;
  }

  const config = getScoringConfig();
  const { byAgent, total } = runTotals(data.runLog);
  const stages: StageView[] = data.summary.stages.map((summary) => {
    const info = STAGE_INFO[summary.stage] ?? { stage: summary.stage, file: "", prompt: null, agent: null, units: ["in", "out"], does: "" };
    return {
      summary,
      info,
      totals: byAgent.find((a) => a.agent === info.agent) ?? null,
      ...stageSample(data, summary.stage, config),
    };
  });
  const models = [...new Set(data.runLog.map((r) => r.model).filter(Boolean))];
  const flow = data.summary.stages.map((s) => `${s.outCount} ${STAGE_INFO[s.stage]?.units[1] ?? ""}`.trim());

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">
          Run of {formatDate(data.summary.generatedAt.slice(0, 10))} · {data.summary.mode === "sample" ? "sample data" : "real pipeline run"}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">How it works</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">
          Five LLM agents do the reading; plain code does the counting and the deciding. Each box shows how many items
          went in and came out in this run. Click one to see a real input and output.
        </p>
        <p className="mt-3 font-mono text-sm text-ink-2">{flow.join(" → ")}</p>
      </div>

      <PipelineView stages={stages} />

      <section aria-labelledby="eval-title">
        <h2 id="eval-title" className="border-b-2 border-rule-strong pb-1 font-serif text-2xl font-semibold">
          How accurate are the agents?
        </h2>
        <EvalPanel
          report={data.evalReport}
          stale={data.evalReport !== null && data.evalReport.evaluatedAt < data.summary.generatedAt}
        />
      </section>

      <section aria-labelledby="cost-title">
        <h2 id="cost-title" className="border-b-2 border-rule-strong pb-1 font-serif text-2xl font-semibold">
          Cost and latency log
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["LLM calls", fmt(total.calls)],
            ["Input tokens", fmt(total.inputTokens)],
            ["Output tokens", fmt(total.outputTokens)],
            ["Agent time", `${(total.ms / 1000).toFixed(1)} s`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-widest text-ink-3">{k}</dt>
              <dd className="font-mono text-3xl">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-3">
          {fmt(total.cacheReadTokens)} input tokens were read from the prompt cache. Agent time is the sum of every
          call; calls run in parallel, so the run itself is shorter. Models: {models.join(", ") || "none"}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-3">
              <tr className="border-b border-rule">
                <th className="py-2 font-semibold">Agent</th>
                <th className="py-2 text-right font-semibold">Calls</th>
                <th className="py-2 text-right font-semibold">Input</th>
                <th className="py-2 text-right font-semibold">Output</th>
                <th className="py-2 text-right font-semibold">Cache read</th>
                <th className="py-2 text-right font-semibold">Time</th>
                <th className="py-2 text-right font-semibold">Retries</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {byAgent.map((a) => (
                <tr key={a.agent} className="border-b border-rule">
                  <td className="py-2 font-sans">{a.agent}</td>
                  <td className="py-2 text-right">{a.calls}</td>
                  <td className="py-2 text-right">{fmt(a.inputTokens)}</td>
                  <td className="py-2 text-right">{fmt(a.outputTokens)}</td>
                  <td className="py-2 text-right">{fmt(a.cacheReadTokens)}</td>
                  <td className="py-2 text-right">{(a.ms / 1000).toFixed(1)} s</td>
                  <td className="py-2 text-right">{a.retries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.summary.failures.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-3">Skipped items</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
              {data.summary.failures.map((f) => (
                <li key={`${f.agent}-${f.itemId}`}>
                  {f.agent} on {f.itemId}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
