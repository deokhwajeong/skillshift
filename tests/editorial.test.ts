import { describe, expect, it } from "vitest";
import { containsExcerpt } from "@/lib/text";
import { applyDecisions, decide, decisionFor } from "@/pipeline/editorial";
import type { Shift, VerificationResult } from "@/pipeline/schemas";

const editorial = { filterMinRelevance: 0.5, publishMinConfidence: 0.7 };

const shift = (over: Partial<Shift> = {}): Shift => ({
  id: "a#s1",
  articleId: "a",
  kind: "practice",
  summary: "Teams add evaluation gates.",
  excerpt: "evaluation gates",
  skillIds: ["llm-evaluation"],
  candidateSkill: null,
  confidence: 0.9,
  ...over,
});

const verdict = (over: Partial<VerificationResult> = {}): VerificationResult => ({
  shiftId: "a#s1",
  supported: true,
  evidenceLevel: "Strong",
  conflictsWith: [],
  note: "Stated directly.",
  ...over,
});

describe("containsExcerpt", () => {
  const source = "Teams said they could not prove an agent was “safe to ship” without\n  regression tests.";
  it("matches ignoring case, line breaks, quote style, and edge punctuation", () => {
    expect(containsExcerpt(source, 'could not prove an agent was "safe to ship" without regression tests.')).toBe(true);
    expect(containsExcerpt(source, "TEAMS SAID")).toBe(true);
  });
  it("treats en and em dashes as hyphens but keeps digits intact", () => {
    expect(containsExcerpt("an AI–driven shift in 2026", "AI-driven shift in 2026")).toBe(true);
    expect(containsExcerpt("cut cost by 30 percent", "cut cost by 20 percent")).toBe(false);
  });

  it("rejects paraphrases and empty strings", () => {
    expect(containsExcerpt(source, "teams could not prove agents were safe")).toBe(false);
    expect(containsExcerpt(source, " ")).toBe(false);
  });
});

describe("editorial policy", () => {
  it("publishes a supported, confident, strong, conflict-free shift", () => {
    const { shift: s, queueItems } = decide(shift(), verdict(), true, editorial);
    expect(s.status).toBe("published");
    expect(queueItems).toEqual([]);
  });

  it.each([
    ["excerpt missing", shift(), verdict(), false, /excerpt not found/i],
    ["unsupported", shift(), verdict({ supported: false }), true, /does not support/],
    ["low confidence", shift({ confidence: 0.6 }), verdict(), true, /0\.60 is below 0\.7/],
    ["weak evidence", shift(), verdict({ evidenceLevel: "Weak" }), true, /Weak/],
  ])("queues when %s", (_label, s, v, found, reason) => {
    const out = decide(s, v, found, editorial);
    expect(out.shift.status).toBe("queued");
    expect(out.queueItems).toHaveLength(1);
    expect(out.queueItems[0].kind).toBe("low-confidence");
    expect(out.queueItems[0].reason).toMatch(reason);
  });

  it("queues conflicts as their own item", () => {
    const out = decide(shift(), verdict({ conflictsWith: ["b#s2"] }), true, editorial);
    expect(out.shift.status).toBe("queued");
    expect(out.queueItems.map((q) => q.kind)).toEqual(["conflict"]);
  });

  it("publishes the shift but still queues a proposed new skill", () => {
    const out = decide(shift({ candidateSkill: { name: "Agent ops", description: "Runs agents." } }), verdict(), true, editorial);
    expect(out.shift.status).toBe("published");
    expect(out.queueItems.map((q) => q.kind)).toEqual(["candidate-skill"]);
  });

  it("queues a shift that maps only to a proposed new skill", () => {
    const out = decide(shift({ skillIds: [], candidateSkill: { name: "Agent ops", description: "Runs agents." } }), verdict(), true, editorial);
    expect(out.shift.status).toBe("queued");
  });
});

describe("applyDecisions (human in the loop)", () => {
  // A weak, conflicting shift: two blocking items.
  const held = decide(shift({ confidence: 0.5 }), verdict({ evidenceLevel: "Weak", conflictsWith: ["b#s1"] }), true, editorial);
  const at = "2026-10-22T00:00:00Z";
  const [low, conflict] = held.queueItems;

  it("publishes a held shift only when every blocking item is approved", () => {
    const one = applyDecisions([held.shift], held.queueItems, [decisionFor(low, held.shift, "approve", at)]);
    expect(one.shifts[0].status).toBe("queued");
    const both = applyDecisions([held.shift], held.queueItems, [
      decisionFor(low, held.shift, "approve", at),
      decisionFor(conflict, held.shift, "approve", at),
    ]);
    expect(both.shifts[0].status).toBe("published");
    expect(both.approvedShiftIds).toEqual(["a#s1"]);
    expect(both.queue.map((q) => q.decision)).toEqual(["approve", "approve"]);
  });

  it("keeps a rejected shift out", () => {
    const out = applyDecisions([held.shift], held.queueItems, [
      decisionFor(low, held.shift, "approve", at),
      decisionFor(conflict, held.shift, "reject", at),
    ]);
    expect(out.shifts[0].status).toBe("queued");
  });

  it("matches decisions by article and excerpt, so renumbered shifts keep their decisions", () => {
    const decisions = [decisionFor(low, held.shift, "approve", at), decisionFor(conflict, held.shift, "approve", at)];
    const renumbered = { ...held.shift, id: "a#s2" };
    const queue = held.queueItems.map((q) => ({ ...q, id: q.id.replace("#s1", "#s2"), shiftId: "a#s2" }));
    expect(applyDecisions([renumbered], queue, decisions).shifts[0].status).toBe("published");
  });

  it("approving a proposed new skill does not publish a shift with no taxonomy skill", () => {
    const candidate = decide(shift({ skillIds: [], candidateSkill: { name: "X", description: "Y" } }), verdict(), true, editorial);
    const out = applyDecisions([candidate.shift], candidate.queueItems, [decisionFor(candidate.queueItems[0], candidate.shift, "approve", at)]);
    expect(out.shifts[0].status).toBe("queued");
  });
});
