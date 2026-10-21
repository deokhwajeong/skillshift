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
 */
import type { EditorQueueItem, ScoringConfig, Shift, VerificationResult, VerifiedShift } from "./schemas";

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
