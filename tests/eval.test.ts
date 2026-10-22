import { describe, expect, it } from "vitest";
import { evaluate, metrics } from "@/eval/evaluate";
import type { EvalLabelsFile, FilterDecision, JDSkillMention, Shift } from "@/pipeline/schemas";

const shift = (articleId: string, skillIds: string[], n = 1): Shift => ({
  id: `${articleId}#s${n}`,
  articleId,
  kind: "practice",
  summary: "x",
  excerpt: "x",
  skillIds,
  candidateSkill: null,
  confidence: 0.9,
});
const keep = (articleId: string, k = true): FilterDecision => ({ articleId, keep: k, relevance: k ? 0.9 : 0.1, reason: "r", duplicateOf: null });
const mention = (jdId: string, skillId: string, requirement: "required" | "preferred"): JDSkillMention => ({ jdId, skillId, requirement, excerpt: "x" });

const labels: EvalLabelsFile = {
  version: 1,
  role: "tpm",
  articles: [
    { articleId: "a", skillIds: ["eval", "gov"] }, // agent finds eval + cost: 1 right, 1 extra, 1 missed
    { articleId: "b", skillIds: ["cost"] }, // dropped by the filter: skipped
  ],
  jds: [{ jdId: "j", required: ["lead"], preferred: ["eval"] }],
};

const run = (over: Partial<Parameters<typeof evaluate>[0]> = {}) =>
  evaluate({
    labels,
    mode: "sample",
    filter: [keep("a"), keep("b", false)],
    shifts: [shift("a", ["eval"]), shift("a", ["cost"], 2)],
    jdMentions: [mention("j", "lead", "required"), mention("j", "eval", "required")],
    analyzedJdIds: ["j"],
    evaluatedAt: "2026-10-22T00:00:00Z",
    ...over,
  });

describe("metrics", () => {
  it("computes precision, recall, and F1, and n/a when there is nothing to divide by", () => {
    expect(metrics({ truePositives: 3, falsePositives: 1, falseNegatives: 3 })).toMatchObject({ precision: 0.75, recall: 0.5, f1: 0.6 });
    expect(metrics({ truePositives: 0, falsePositives: 0, falseNegatives: 2 })).toMatchObject({ precision: null, recall: 0, f1: null });
  });
});

describe("evaluate", () => {
  it("grades Shift Extraction per (article, skill) and skips articles the Filter dropped", () => {
    const sx = run().shiftExtraction;
    expect(sx).toMatchObject({ truePositives: 1, falsePositives: 1, falseNegatives: 1, precision: 0.5, recall: 0.5, articles: 1 });
    expect(sx.skippedDropped).toEqual(["b"]);
    expect(sx.errors).toEqual([{ itemId: "a", missed: ["gov"], extra: ["cost"] }]);
  });

  it("grades JD Analyzer skills and, separately, required vs preferred", () => {
    const jd = run().jdAnalyzer;
    expect(jd).toMatchObject({ precision: 1, recall: 1, requirementAccuracy: 0.5, errors: [] });
  });

  it("rejects labels for items that are not in the run", () => {
    expect(() => run({ analyzedJdIds: [] })).toThrow(/JD j/);
  });
});
