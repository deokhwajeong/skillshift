"use client";

/**
 * Skill detail is prerendered from the published run. When this browser has
 * Editor Queue decisions that change this skill, say so and show the
 * re-scored numbers (the same ones the Today matrix shows), so the two pages
 * never silently disagree.
 */
import Link from "next/link";
import { useMemo } from "react";
import type { SkillScore } from "@/pipeline/schemas";
import { useDecisions } from "@/lib/decision-store";
import { rescore, type RescoreInput } from "@/lib/rescore";

export function LocalDecisionsNotice({ input, skillId, baseline }: { input: RescoreInput; skillId: string; baseline: SkillScore }) {
  const decisions = useDecisions(input.role);
  const result = useMemo(() => (decisions.length ? rescore(input, decisions) : null), [input, decisions]);
  if (!result) return null;

  const after = result.scores.find((s) => s.skillId === skillId);
  const statusChanged = result.shifts.some(
    (s) => s.skillIds.includes(skillId) && s.status !== input.shifts.find((o) => o.id === s.id)?.status,
  );
  const scoreChanged = after && (after.quadrant !== baseline.quadrant || after.newsSignal !== baseline.newsSignal);
  if (!after || (!scoreChanged && !statusChanged)) return null;

  return (
    <div role="status" className="rounded-md border border-accent px-4 py-3 text-sm">
      <p>
        <strong>Your Editor Queue decisions change this skill.</strong> With them it is{" "}
        <strong>{after.quadrant}</strong> (news {after.newsSignal.toFixed(2)}, was {baseline.quadrant} at{" "}
        {baseline.newsSignal.toFixed(2)}), as on the Today matrix.
      </p>
      <p className="mt-1 text-ink-2">
        The scores and evidence below show the published run; the next pipeline run includes your exported decisions.{" "}
        <Link href={`/${input.role}/editor`} className="font-semibold text-accent underline">
          Review decisions
        </Link>
      </p>
    </div>
  );
}
