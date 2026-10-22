/**
 * evaluate.ts: precision and recall of two LLM agents against hand labels.
 *
 * Purpose:   Turn "the extraction seems good" into a number for the pitch.
 * Input:     EvalLabelsFile (data/eval/<role>.json) and the pipeline output
 *            (filter decisions, shifts, JD mentions).
 * Output:    EvalReport.
 * Uses LLM:  No. It only compares what the agents already produced.
 * Failure:   Labels that point at unknown articles or JDs throw, so a typo in
 *            the labels cannot quietly shrink the test set.
 *
 * Unit of comparison: an (item, skill) pair.
 *   Shift Extraction: predicted = every skill any extracted shift of the article
 *                     maps to (published or queued: we grade the extractor, not
 *                     the editorial policy). Articles the Filter dropped are skipped.
 *   JD Analyzer:      predicted = every skill found in the JD; labeled = required
 *                     plus preferred. Separately, of the skills that match, how
 *                     often "required" vs "preferred" was right.
 *   precision = correct / predicted, recall = correct / labeled, both micro-averaged.
 */
import type { EvalLabelsFile, EvalReport, FilterDecision, JDSkillMention, Shift } from "@/pipeline/schemas";

export interface EvalInput {
  labels: EvalLabelsFile;
  mode: "pipeline" | "sample";
  filter: FilterDecision[];
  shifts: Shift[];
  jdMentions: JDSkillMention[];
  /** JDs the analyzer actually processed. */
  analyzedJdIds: string[];
  evaluatedAt: string;
}

type Counts = { truePositives: number; falsePositives: number; falseNegatives: number };
type ItemError = { itemId: string; missed: string[]; extra: string[] };

const ratio = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 1000);

export function metrics(c: Counts) {
  const precision = ratio(c.truePositives, c.truePositives + c.falsePositives);
  const recall = ratio(c.truePositives, c.truePositives + c.falseNegatives);
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000
    : null;
  return { ...c, precision, recall, f1 };
}

/** Compare one item's predicted and labeled skill sets, adding to the running counts. */
function compare(itemId: string, predicted: Set<string>, labeled: Set<string>, counts: Counts, errors: ItemError[]) {
  const missed = [...labeled].filter((s) => !predicted.has(s)).sort();
  const extra = [...predicted].filter((s) => !labeled.has(s)).sort();
  counts.truePositives += [...predicted].filter((s) => labeled.has(s)).length;
  counts.falsePositives += extra.length;
  counts.falseNegatives += missed.length;
  if (missed.length || extra.length) errors.push({ itemId, missed, extra });
}

export function evaluate(input: EvalInput): EvalReport {
  const { labels } = input;
  const known = new Set(input.filter.map((f) => f.articleId));
  const kept = new Set(input.filter.filter((f) => f.keep).map((f) => f.articleId));
  const analyzed = new Set(input.analyzedJdIds);
  const unknown = [
    ...labels.articles.filter((a) => !known.has(a.articleId)).map((a) => `article ${a.articleId}`),
    ...labels.jds.filter((j) => !analyzed.has(j.jdId)).map((j) => `JD ${j.jdId}`),
  ];
  if (unknown.length) throw new Error(`Labels refer to items not in this run: ${unknown.join(", ")}`);

  // Shift Extraction
  const sx: Counts = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
  const sxErrors: ItemError[] = [];
  const skippedDropped: string[] = [];
  for (const label of labels.articles) {
    if (!kept.has(label.articleId)) {
      skippedDropped.push(label.articleId);
      continue;
    }
    const predicted = new Set(input.shifts.filter((s) => s.articleId === label.articleId).flatMap((s) => s.skillIds));
    compare(label.articleId, predicted, new Set(label.skillIds), sx, sxErrors);
  }

  // JD Analyzer
  const jd: Counts = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
  const jdErrors: ItemError[] = [];
  let reqRight = 0;
  let reqTotal = 0;
  for (const label of labels.jds) {
    const found = input.jdMentions.filter((m) => m.jdId === label.jdId);
    const required = new Set(label.required);
    const labeled = new Set([...label.required, ...label.preferred]);
    compare(label.jdId, new Set(found.map((m) => m.skillId)), labeled, jd, jdErrors);
    for (const m of found.filter((m) => labeled.has(m.skillId))) {
      reqTotal++;
      if ((m.requirement === "required") === required.has(m.skillId)) reqRight++;
    }
  }

  return {
    mode: input.mode,
    role: labels.role,
    evaluatedAt: input.evaluatedAt,
    shiftExtraction: { ...metrics(sx), articles: labels.articles.length - skippedDropped.length, skippedDropped, errors: sxErrors },
    jdAnalyzer: { ...metrics(jd), jds: labels.jds.length, requirementAccuracy: ratio(reqRight, reqTotal), errors: jdErrors },
  };
}

/** A labeling file with every item listed and empty skill lists, for a human to fill in. */
export function labelTemplate(role: string, articleIds: string[], jdIds: string[]): EvalLabelsFile {
  return {
    version: 1,
    role,
    articles: articleIds.map((articleId) => ({ articleId, skillIds: [] })),
    jds: jdIds.map((jdId) => ({ jdId, required: [], preferred: [] })),
  };
}
