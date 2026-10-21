/**
 * Verification Agent
 *
 * Purpose:   Check each extracted shift against its source before it can count:
 *            is the excerpt real, does the article support the claim, how strong
 *            is the evidence, and does another source say the opposite?
 * Input:     The article, its shifts, shifts from other articles that share a
 *            skill (for conflict checks), and the editorial thresholds.
 * Output:    { shifts: VerifiedShift[], queue: EditorQueueItem[] }.
 * Uses LLM:  Partly. Step 1 is code: the excerpt must appear word for word in the
 *            article. Step 2 is the LLM: supported / evidence level / conflicts.
 *            Step 3 is code again: src/pipeline/editorial.ts decides publish or queue.
 * Failure:   Throws AgentFailure. The orchestrator then queues every shift from
 *            that article with the reason "verification failed" (never auto-publish).
 */
import { z } from "zod";
import type { Llm } from "@/lib/llm";
import { modelFor } from "@/lib/llm";
import { containsExcerpt } from "@/lib/text";
import { decide } from "@/pipeline/editorial";
import {
  EvidenceLevel,
  type Article,
  type EditorQueueItem,
  type ScoringConfig,
  type Shift,
  type VerificationResult,
  type VerifiedShift,
} from "@/pipeline/schemas";
import { verificationSystemPrompt, verificationUserPrompt } from "./prompts/verification";
import { idEnum } from "./schema-helpers";

export const AGENT = "verification";

export interface VerificationInput {
  article: Article;
  shifts: Shift[];
  otherShifts: Shift[];
  editorial: ScoringConfig["editorial"];
}

export interface VerificationOutput {
  shifts: VerifiedShift[];
  queue: EditorQueueItem[];
}

export async function runVerification(llm: Llm, input: VerificationInput): Promise<VerificationOutput> {
  const { article, shifts, otherShifts, editorial } = input;
  if (shifts.length === 0) return { shifts: [], queue: [] };

  // Step 1 (code): is each excerpt really in the article?
  const withCheck = shifts.map((s) => ({ ...s, excerptFound: containsExcerpt(article.body, s.excerpt) }));

  // Step 2 (LLM): judge support, evidence, conflicts.
  const otherIds = otherShifts.map((s) => s.id);
  const schema = z.object({
    results: z.array(
      z.object({
        shiftId: idEnum(shifts.map((s) => s.id)),
        supported: z.boolean(),
        evidenceLevel: EvidenceLevel,
        conflictsWith: z.array(idEnum(otherIds)),
        note: z.string().min(1),
      }),
    ),
  });
  const out = await llm.call({
    agent: AGENT,
    itemId: article.id,
    model: modelFor(AGENT),
    effort: "medium",
    system: verificationSystemPrompt(),
    user: verificationUserPrompt(article, withCheck, otherShifts),
    schema,
  });

  // Step 3 (code): apply the editorial policy to each shift.
  const byId = new Map(out.results.map((r) => [r.shiftId, r]));
  const verified: VerifiedShift[] = [];
  const queue: EditorQueueItem[] = [];
  for (const shift of withCheck) {
    const { excerptFound, ...plain } = shift;
    const result: VerificationResult = byId.get(shift.id)
      ? { ...byId.get(shift.id)!, conflictsWith: byId.get(shift.id)!.conflictsWith.filter((id) => otherIds.includes(id)) }
      : { shiftId: shift.id, supported: false, evidenceLevel: "Weak", conflictsWith: [], note: "The verifier returned no judgment for this shift." };
    const decision = decide(plain, result, excerptFound, editorial);
    verified.push(decision.shift);
    queue.push(...decision.queueItems);
  }
  return { shifts: verified, queue };
}

/** Used when the verifier itself fails: keep the shifts, but nothing auto-publishes. */
export function unverified(shifts: Shift[], article: Article, error: string): VerificationOutput {
  return {
    shifts: shifts.map((s) => ({
      ...s,
      excerptFound: containsExcerpt(article.body, s.excerpt),
      verification: { shiftId: s.id, supported: false, evidenceLevel: "Weak", conflictsWith: [], note: `Verification failed: ${error}` },
      status: "queued",
    })),
    queue: shifts.map((s) => ({
      id: `${s.id}:low-confidence`,
      kind: "low-confidence",
      shiftId: s.id,
      reason: "Verification failed, so this shift needs a human check before publishing.",
    })),
  };
}
