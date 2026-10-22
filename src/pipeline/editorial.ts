/**
 * editorial.ts: the human-in-the-loop policy, as plain code.
 *
 * AI does the reading; this file decides what the AI is allowed to publish on
 * its own and what waits for a human in the Editor Queue. No LLM here, so the
 * policy is predictable, testable, and easy to change in one place.
 *
 * A shift is PUBLISHED only if ALL of these hold:
 *   - its excerpt appears word for word in the article (code check)
 *   - the Verification Agent says the article supports it
 *   - the extractor's confidence >= editorial.publishMinConfidence
 *   - the evidence level is not Weak
 *   - it does not conflict with another source
 *   - it maps to at least one existing taxonomy skill
 * Otherwise it is QUEUED, with each reason spelled out for the editor.
 * A proposed new skill always goes to the queue, even when the shift itself
 * publishes for its existing skills.
 *
 * Human decisions (applyDecisions below): a queued shift is PUBLISHED once an
 * editor approves every item that blocked it. Rejecting, or not deciding yet,
 * keeps it out. Approving a proposed new skill only records the decision; the
 * skill starts counting when someone adds it to config/taxonomy.json.
 */
import type { EditorDecision, EditorQueueItem, ScoringConfig, Shift, VerificationResult, VerifiedShift } from "./schemas";

export interface EditorialDecision {
  shift: VerifiedShift;
  queueItems: EditorQueueItem[];
}

export function decide(
  shift: Shift,
  verification: VerificationResult,
  excerptFound: boolean,
  editorial: ScoringConfig["editorial"],
): EditorialDecision {
  const lowConfidence: string[] = [];
  if (!excerptFound) lowConfidence.push("excerpt not found word for word in the source");
  if (!verification.supported) lowConfidence.push(`verifier says the article does not support it (${verification.note})`);
  if (shift.confidence < editorial.publishMinConfidence) {
    lowConfidence.push(`extractor confidence ${shift.confidence.toFixed(2)} is below ${editorial.publishMinConfidence}`);
  }
  if (verification.evidenceLevel === "Weak") lowConfidence.push("evidence level is Weak");

  const queueItems: EditorQueueItem[] = [];
  if (lowConfidence.length) {
    queueItems.push({ id: `${shift.id}:low-confidence`, kind: "low-confidence", shiftId: shift.id, reason: capitalize(lowConfidence.join("; ")) });
  }
  if (verification.conflictsWith.length) {
    queueItems.push({
      id: `${shift.id}:conflict`,
      kind: "conflict",
      shiftId: shift.id,
      reason: `Conflicts with ${verification.conflictsWith.join(", ")}. ${verification.note}`,
    });
  }
  if (shift.candidateSkill) {
    queueItems.push({
      id: `${shift.id}:candidate-skill`,
      kind: "candidate-skill",
      shiftId: shift.id,
      reason: `Proposed new skill "${shift.candidateSkill.name}": ${shift.candidateSkill.description}`,
    });
  }

  const blocked = queueItems.some((q) => q.kind !== "candidate-skill") || shift.skillIds.length === 0;
  return {
    shift: { ...shift, excerptFound, verification, status: blocked ? "queued" : "published" },
    queueItems,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Decisions match on article + kind + excerpt, so they survive a re-run that
 * renumbers shifts. Every place that looks up a decision uses this key.
 */
export const decisionKey = (d: { articleId: string; kind: string; excerpt: string }) =>
  `${d.articleId}|${d.kind}|${d.excerpt.trim().toLowerCase().replace(/\s+/g, " ")}`;

/** The key of a queue item, from the shift it is about. */
export const itemKey = (item: EditorQueueItem, shift: VerifiedShift) =>
  decisionKey({ articleId: shift.articleId, kind: item.kind, excerpt: shift.excerpt });

/**
 * A decision as the browser stores it. "pending" re-opens an item that
 * decisions.json had already decided (the Undo button); it never goes in the file.
 */
export type DecisionInput = Omit<EditorDecision, "decision"> & { decision: EditorDecision["decision"] | "pending" };

export interface AppliedDecisions {
  shifts: VerifiedShift[];
  /** The queue with each item's decision filled in (undefined = still pending). */
  queue: EditorQueueItem[];
  /** Shift ids that moved from queued to published because of an approval. */
  approvedShiftIds: string[];
}

/**
 * Apply human decisions to the pipeline's shifts and queue. Pure function:
 * the pipeline runs it with data/editorial/decisions.json, and the browser runs
 * it with the decisions made on the Editor Queue screen, then re-scores.
 * A later decision for the same item wins; "pending" means undecided.
 */
export function applyDecisions(shifts: VerifiedShift[], queue: EditorQueueItem[], decisions: DecisionInput[]): AppliedDecisions {
  const byKey = new Map(decisions.map((d) => [decisionKey(d), d]));
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const decided = queue.map((item): EditorQueueItem => {
    const shift = shiftById.get(item.shiftId);
    const found = shift ? byKey.get(itemKey(item, shift)) : undefined;
    return !found || found.decision === "pending"
      ? { ...item, decision: undefined, decidedAt: undefined }
      : { ...item, decision: found.decision, decidedAt: found.decidedAt };
  });

  const approvedShiftIds: string[] = [];
  const updated = shifts.map((shift): VerifiedShift => {
    if (shift.status !== "queued" || shift.skillIds.length === 0) return shift;
    const blocking = decided.filter((q) => q.shiftId === shift.id && q.kind !== "candidate-skill");
    if (blocking.length === 0 || !blocking.every((q) => q.decision === "approve")) return shift;
    approvedShiftIds.push(shift.id);
    return { ...shift, status: "published" };
  });
  return { shifts: updated, queue: decided, approvedShiftIds };
}

/** The decision record for one queue item, ready to store or export. */
export function decisionFor(item: EditorQueueItem, shift: VerifiedShift, decision: "approve" | "reject", decidedAt: string): EditorDecision {
  return { itemId: item.id, kind: item.kind, articleId: shift.articleId, excerpt: shift.excerpt, decision, decidedAt };
}
