"use client";

/**
 * Live mode UI: a form, a step list that fills in as the server streams
 * progress (newline-delimited JSON from /api/live), and the result.
 * If the run fails for any reason (no key, wrong passphrase, timeout, API
 * error), it says why and replays the cached run instead, clearly labeled.
 */
import { useEffect, useRef, useState } from "react";
import { LiveEvent, type LiveArticleInput, type LiveCacheFile, type LiveResult } from "@/pipeline/schemas";
import { AiLabel, SourceQuote } from "./ai-label";
import { QuadrantMarker } from "./quadrant";
import { SignalMatrix, type MatrixPoint } from "./signal-matrix";

const STEPS = [
  { stage: "ingest", label: "Ingest", llm: false },
  { stage: "filter", label: "Filter", llm: true },
  { stage: "extract", label: "Shift Extraction", llm: true },
  { stage: "verify", label: "Verification", llm: true },
  { stage: "score", label: "Signal Scorer", llm: false },
];

type StepState = { status: "waiting" | "running" | "done"; message: string };
/** "weak" = the prepared weak article (the failure-path demo); "demo" = the regular recorded run. */
type Recording = "demo" | "weak";
type Source = { kind: "live" } | { kind: "cache"; reason: string | null; which: Recording };

const emptyForm: LiveArticleInput = { title: "", source: "", url: "", publishedDate: "", sourceType: "trade", body: "" };
const initialSteps = () => Object.fromEntries(STEPS.map((s) => [s.stage, { status: "waiting", message: "" } as StepState]));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Set by `npm run build:demo`: a static copy of the site has no server to run agents on. */
const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

export function LiveMode({
  role,
  names,
  cache,
  weakCache,
  newsStrong,
  jdStrong,
  publishMinConfidence,
}: {
  role: string;
  names: Record<string, string>;
  cache: LiveCacheFile | null;
  /** The precomputed run of data/live/weak-article.md, for "Try a weak input". */
  weakCache: LiveCacheFile | null;
  newsStrong: number;
  jdStrong: number;
  publishMinConfidence: number;
}) {
  const [form, setForm] = useState<LiveArticleInput>(emptyForm);
  const [passphrase, setPassphrase] = useState("");
  const [steps, setSteps] = useState<Record<string, StepState>>(initialSteps);
  const [result, setResult] = useState<LiveResult | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);
  // The in-flight live request. Abandoning a run (a replay, a new run, leaving the page)
  // aborts it, so the server stops paying for agent calls nobody will see.
  const inFlight = useRef<AbortController | null>(null);
  const cancelInFlight = () => {
    inFlight.current?.abort();
    inFlight.current = null;
  };
  useEffect(
    () => () => {
      runId.current++; // invalidate first, so the abort is not treated as a failure
      cancelInFlight();
    },
    [],
  );

  const apply = (e: LiveEvent) => {
    if (e.type === "stage") {
      setSteps((prev) => ({ ...prev, [e.stage]: { status: e.status === "start" ? "running" : "done", message: e.message } }));
    } else if (e.type === "result") {
      setResult(e.result);
    }
  };

  /** Play back the recorded run, with short pauses so the steps read like a run. */
  const replay = async (reason: string | null, which: Recording = "demo") => {
    const recording = which === "weak" ? weakCache : cache;
    if (!recording) return;
    const id = ++runId.current;
    cancelInFlight();
    setSource({ kind: "cache", reason, which });
    setSteps(initialSteps());
    setResult(null);
    for (const e of recording.events) {
      await sleep(e.type === "stage" && e.status === "start" ? 450 : 250);
      if (runId.current !== id) return; // a newer run started while we waited
      apply(e);
    }
  };

  const run = async () => {
    if (STATIC_DEMO) {
      await replay("this is the static demo, which has no server to run the agents on.");
      return;
    }
    const id = ++runId.current;
    cancelInFlight();
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true);
    setSource({ kind: "live" });
    setSteps(initialSteps());
    setResult(null);
    let failure: string | null = null;
    try {
      const response = await fetch("/api/live", {
        signal: controller.signal,
        method: "POST",
        headers: { "content-type": "application/json", "x-live-passphrase": passphrase },
        body: JSON.stringify({ role, article: form }),
      });
      if (!response.body) throw new Error(`Server answered ${response.status} with no body.`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotResult = false;
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = LiveEvent.safeParse(JSON.parse(line));
          if (!event.success) throw new Error("The server sent something unexpected.");
          if (event.data.type === "error") throw new Error(event.data.message);
          if (event.data.type === "result") gotResult = true;
          if (runId.current === id) apply(event.data);
        }
        if (done) break;
      }
      if (!gotResult) throw new Error("The run ended without a result.");
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      setBusy(false);
    }
    if (failure && runId.current === id) {
      if (cache) await replay(failure);
      else setSource({ kind: "cache", reason: `${failure} No cached run is available.`, which: "demo" });
    }
  };

  const field = (key: keyof LiveArticleInput, label: string, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <input
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="rounded-md border border-rule bg-paper px-3 py-2 text-ink focus:border-ink"
      />
    </label>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="flex flex-col gap-4"
      >
        {STATIC_DEMO && (
          <p className="rounded-md border border-sample p-3 text-sm">
            Static demo: there is no server here, so <strong>Run live</strong> replays a recorded run of the demo article.
            The full version runs the agents on any article you paste.
          </p>
        )}
        {weakCache && (
          <div className="rounded-md border border-rule p-3">
            <button
              type="button"
              onClick={() => {
                setForm(weakCache.input);
                void replay(null, "weak");
              }}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-paper hover:opacity-85"
            >
              Try a weak input
            </button>
            <p className="mt-1.5 text-xs text-ink-3">
              Runs a vague opinion piece with no real skill evidence and shows why nothing from it is published.
              Precomputed for demo, so no API call is made.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {cache && (
            <button type="button" onClick={() => setForm(cache.input)} className="rounded-full border border-rule px-3 py-1 text-sm hover:border-ink">
              Fill with the demo article
            </button>
          )}
          {cache && (
            <button type="button" onClick={() => void replay(null)} className="rounded-full border border-rule px-3 py-1 text-sm hover:border-ink">
              Replay the cached run (no API)
            </button>
          )}
        </div>
        {field("title", "Title")}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("source", "Source")}
          {field("publishedDate", "Published", "date")}
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          {field("url", "URL", "url")}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Source type</span>
            <select
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value as LiveArticleInput["sourceType"] })}
              className="rounded-md border border-rule bg-paper px-3 py-2 text-ink"
            >
              <option value="primary">Primary</option>
              <option value="trade">Trade press</option>
              <option value="blog">Blog</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Article text</span>
          <textarea
            required
            rows={10}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="rounded-md border border-rule bg-paper px-3 py-2 font-serif text-[15px] leading-relaxed text-ink focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Passphrase</span>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-ink focus:border-ink"
          />
          <span className="text-xs text-ink-3">Protects the API key from strangers. Not needed on a local dev server.</span>
        </label>
        <button type="submit" disabled={busy} className="self-start rounded-full bg-ink px-5 py-2 font-semibold text-paper hover:opacity-85 disabled:opacity-50">
          {busy ? "Running..." : "Run live"}
        </button>
      </form>

      <div className="flex flex-col gap-6">
        {source?.kind === "cache" && (
          <div role="status" className="rounded-md border-2 border-sample p-4 text-sm">
            {source.reason && (
              <p>
                <strong>Live run failed:</strong> {source.reason}
              </p>
            )}
            {(() => {
              const recording = source.which === "weak" ? weakCache : cache;
              if (!recording) return null;
              return (
                <p className={source.reason ? "mt-1" : ""}>
                  {source.which === "weak" ? (
                    <>
                      <strong>Precomputed for demo:</strong> a recorded run of a deliberately weak article, recorded{" "}
                      {recording.recordedAt.slice(0, 10)}. No API call is made.
                    </>
                  ) : (
                    <>Showing the cached run of the demo article, recorded {recording.recordedAt.slice(0, 10)}. No API call is made.</>
                  )}
                  {recording.mode === "sample" && <strong> SAMPLE: answers were scripted, not written by a model.</strong>}
                </p>
              );
            })()}
          </div>
        )}

        <ol className="flex flex-col gap-2" aria-label="Steps">
          {STEPS.map((s, i) => {
            const st = steps[s.stage];
            return (
              <li key={s.stage} className="flex gap-3 rounded-md border border-rule p-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                    st.status === "done" ? "bg-ink text-paper" : st.status === "running" ? "animate-pulse bg-accent text-paper" : "border border-rule text-ink-3"
                  }`}
                >
                  {st.status === "done" ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {s.label} <span className="font-normal text-ink-3">{s.llm ? "LLM" : "code"}</span>
                    <span className="sr-only"> {st.status}</span>
                  </p>
                  {st.message && <p className="text-sm text-ink-2">{st.message}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        {result && (
          <LiveResultView
            result={result}
            names={names}
            newsStrong={newsStrong}
            jdStrong={jdStrong}
            role={role}
            publishMinConfidence={publishMinConfidence}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Why one shift was published or held: the same checks, in the same order, as
 * decide() in src/pipeline/editorial.ts. Every check must pass to publish.
 */
function PolicyChecks({ shift, retried, minConfidence }: { shift: LiveResult["shifts"][number]; retried: boolean; minConfidence: number }) {
  const v = shift.verification;
  const checks: [boolean, string][] = [
    [true, `Output matched the schema${retried ? " (after one retry: the first answer failed validation)" : ""}`],
    [shift.excerptFound, "Quote appears word for word in the article (code check)"],
    [v.supported, `Verifier: the article supports the claim${v.supported ? "" : ` (${v.note})`}`],
    [shift.confidence >= minConfidence, `Extractor confidence ${shift.confidence.toFixed(2)} is at least ${minConfidence.toFixed(2)}`],
    [v.evidenceLevel !== "Weak", `Evidence level is not Weak (it is ${v.evidenceLevel})`],
    [v.conflictsWith.length === 0, "No conflict with an earlier source"],
    [shift.skillIds.length > 0, "Maps to a skill in the taxonomy"],
  ];
  return (
    <div className="mt-3 border-t border-rule pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Editorial policy checks</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {checks.map(([ok, label]) => (
          <li key={label} className={`flex gap-2 ${ok ? "text-ink-2" : "font-semibold text-ink"}`}>
            <span aria-hidden className={ok ? "text-emerging-ink" : "text-accent"}>
              {ok ? "\u2713" : "\u2717"}
            </span>
            <span>
              <span className="sr-only">{ok ? "Passed: " : "Failed: "}</span>
              {label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs font-semibold">
        {shift.status === "published"
          ? "\u2192 Published: it counts on the matrix and can be cited in the brief."
          : "\u2192 Held: it goes to the Editor Queue for a human, not to the matrix or the brief."}
      </p>
    </div>
  );
}

function LiveResultView({
  result,
  names,
  newsStrong,
  jdStrong,
  role,
  publishMinConfidence,
}: {
  result: LiveResult;
  names: Record<string, string>;
  newsStrong: number;
  jdStrong: number;
  role: string;
  publishMinConfidence: number;
}) {
  const extractionRetried = result.runLog.some((l) => l.agent === "shift-extraction" && l.retries > 0);
  const points: MatrixPoint[] = result.after.map((s) => ({
    id: s.skillId,
    name: names[s.skillId] ?? s.skillId,
    quadrant: s.quadrant,
    newsSignal: s.newsSignal,
    jdSignal: s.jdSignal,
    momentum: s.momentum,
    href: `/${role}/skills/${s.skillId}`,
  }));
  const ghosts = result.changes.map((c) => ({ id: c.skillId, newsSignal: c.before.newsSignal, jdSignal: c.before.jdSignal }));
  const tokens = result.runLog.reduce((t, r) => t + r.inputTokens + r.outputTokens, 0);
  const seconds = result.runLog.reduce((t, r) => t + r.ms, 0) / 1000;

  return (
    <section aria-labelledby="live-result" className="flex flex-col gap-5 border-t-2 border-rule-strong pt-4">
      <h2 id="live-result" className="font-serif text-2xl font-semibold">
        What changed
      </h2>
      {result.shifts.length > 0 && (
        <ul className="flex flex-col gap-3">
          {result.shifts.map((s) => (
            <li key={s.id} className="rounded-md bg-paper-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                  {s.status === "published" ? "Published" : "Held for an editor"} · {s.verification.evidenceLevel} evidence
                </span>
                <span className="text-xs text-ink-3">{s.skillIds.map((id) => names[id] ?? id).join(", ")}</span>
              </div>
              {!s.excerptFound && (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Quote claimed by the AI, not found in the article
                </p>
              )}
              <SourceQuote text={s.excerpt} className="mt-2" />
              <p className="mt-2 text-sm text-ink-2">
                <AiLabel agent="Shift Extraction" className="mr-2" />
                {s.summary}
              </p>
              <PolicyChecks shift={s} retried={extractionRetried} minConfidence={publishMinConfidence} />
            </li>
          ))}
        </ul>
      )}

      {result.changes.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {result.changes.map((c) => (
            <li key={c.skillId} className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold">{names[c.skillId] ?? c.skillId}</span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-2">
                <QuadrantMarker quadrant={c.before.quadrant} /> {c.before.quadrant} {"→"} <QuadrantMarker quadrant={c.after.quadrant} />{" "}
                {c.after.quadrant}, news {c.before.newsSignal.toFixed(2)} {"→"} {c.after.newsSignal.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">No skill scores changed{result.filter.keep ? "." : ": the Filter dropped this article."}</p>
      )}

      <figure>
        <SignalMatrix points={points} ghosts={ghosts} newsStrong={newsStrong} jdStrong={jdStrong} />
        <figcaption className="mt-2 text-xs text-ink-3">
          Dashed circle = before this article, dot = after. Both scored as of {result.asOfDate}, so only this article
          explains the difference. {result.runLog.length} LLM calls, {tokens.toLocaleString("en-US")} tokens,{" "}
          {seconds.toFixed(1)} s.
        </figcaption>
      </figure>
    </section>
  );
}
