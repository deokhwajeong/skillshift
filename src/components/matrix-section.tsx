"use client";

/**
 * The Today matrix plus its quadrant list, re-scored in the browser when this
 * browser has Editor Queue decisions. With no decisions it shows exactly the
 * published scores from data/generated/<role>/scores.json.
 */
import Link from "next/link";
import { useMemo } from "react";
import type { SkillScore } from "@/pipeline/schemas";
import { clearAllDecisions, useDecisions } from "@/lib/decision-store";
import { rescore, type RescoreInput } from "@/lib/rescore";
import { QuadrantMarker } from "./quadrant";
import { QuadrantList } from "./quadrant-list";
import { SignalMatrix, type MatrixPoint } from "./signal-matrix";

export function MatrixSection({ input, baseline, names }: { input: RescoreInput; baseline: SkillScore[]; names: Record<string, string> }) {
  const decisions = useDecisions(input.role);
  const rescored = useMemo(() => (decisions.length ? rescore(input, decisions) : null), [input, decisions]);
  const scores = rescored?.scores ?? baseline;

  const points: MatrixPoint[] = scores.map((s) => ({
    id: s.skillId,
    name: names[s.skillId] ?? s.skillId,
    quadrant: s.quadrant,
    newsSignal: s.newsSignal,
    jdSignal: s.jdSignal,
    momentum: s.momentum,
    href: `/${input.role}/skills/${s.skillId}`,
  }));
  // Where each moved skill was before this browser's decisions, drawn as a faint ghost.
  const base = new Map(baseline.map((s) => [s.skillId, s]));
  const ghosts = rescored
    ? scores.flatMap((s) => {
        const b = base.get(s.skillId);
        return b && (b.newsSignal !== s.newsSignal || b.jdSignal !== s.jdSignal) ? [{ id: s.skillId, newsSignal: b.newsSignal, jdSignal: b.jdSignal }] : [];
      })
    : [];

  return (
    <div className="mt-6 flex flex-col gap-4">
      {decisions.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-accent px-4 py-2 text-sm">
          <span>
            Including <strong>{decisions.length}</strong> Editor Queue decision(s) made in this browser
            {ghosts.length ? `; ${ghosts.length} skill(s) moved (faint dot = before)` : ""}. Today&rsquo;s Brief updates on the next pipeline run.
          </span>
          <Link href={`/${input.role}/editor`} className="font-semibold text-accent underline">
            Review
          </Link>
          <button type="button" onClick={() => clearAllDecisions(input.role)} className="text-ink-2 underline hover:text-ink">
            Reset
          </button>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <figure>
          <SignalMatrix points={points} ghosts={ghosts} newsStrong={input.config.thresholds.newsStrong} jdStrong={input.config.thresholds.jdStrong} />
          <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
            <span>{"\u2191"} more news in the last {input.config.windows.recentDays} days than before</span>
            <span>{"\u2193"} less news than before</span>
            <span className="inline-flex items-center gap-1.5">
              <QuadrantMarker quadrant="Fading" /> Fading
            </span>
            <span className="inline-flex items-center gap-1.5">
              <QuadrantMarker quadrant="Quiet" /> Quiet
            </span>
            <span className="sm:hidden">Tap a dot or a skill below for its evidence.</span>
          </figcaption>
        </figure>
        <QuadrantList scores={scores} names={names} role={input.role} />
      </div>
    </div>
  );
}
