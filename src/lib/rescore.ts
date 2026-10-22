/**
 * rescore.ts: re-run the editorial policy and the Signal Scorer in the browser.
 *
 * Both are pure TypeScript, so the browser runs the exact code the pipeline
 * runs. Editor decisions change which shifts count; the scorer then recomputes
 * every skill. No LLM, no server call.
 */
import { applyDecisions, type DecisionInput } from "@/pipeline/editorial";
import type {
  ArticleCard,
  EditorDecision,
  EditorQueueItem,
  JDSkillMention,
  LiveChange,
  ScoringConfig,
  Skill,
  SkillScore,
  VerifiedShift,
} from "@/pipeline/schemas";
import { scoreSkills } from "@/scoring/signal-scorer";

/** Everything the scorer needs, small enough to send to the browser (no article text). */
export interface RescoreInput {
  role: string;
  skills: Skill[];
  shifts: VerifiedShift[];
  queue: EditorQueueItem[];
  articles: ArticleCard[];
  jdMentions: JDSkillMention[];
  analyzedJdCount: number;
  config: ScoringConfig;
}

export interface Rescored {
  scores: SkillScore[];
  shifts: VerifiedShift[];
  queue: EditorQueueItem[];
  approvedShiftIds: string[];
}

/** Local decisions win over decisions already in the generated queue (from decisions.json). */
export function rescore(input: RescoreInput, local: DecisionInput[]): Rescored {
  const shiftById = new Map(input.shifts.map((s) => [s.id, s]));
  const fromFile = input.queue.flatMap((q): EditorDecision[] => {
    const s = shiftById.get(q.shiftId);
    return q.decision && s
      ? [{ itemId: q.id, kind: q.kind, articleId: s.articleId, excerpt: s.excerpt, decision: q.decision, decidedAt: "" }]
      : [];
  });
  // Re-open shifts the file already approved, so a local "reject" can take them back out.
  const reopened = input.shifts.map((s): VerifiedShift =>
    input.queue.some((q) => q.shiftId === s.id && q.kind !== "candidate-skill") ? { ...s, status: "queued" } : s,
  );
  const applied = applyDecisions(reopened, input.queue, [...fromFile, ...local]);
  const { scores } = scoreSkills({
    role: input.role,
    skills: input.skills,
    shifts: applied.shifts,
    articles: input.articles,
    jdMentions: input.jdMentions,
    analyzedJdCount: input.analyzedJdCount,
    config: input.config,
  });
  return { scores, ...applied };
}

const pick = (s: SkillScore) => ({ quadrant: s.quadrant, newsSignal: s.newsSignal, jdSignal: s.jdSignal, momentum: s.momentum });

/** Skills whose quadrant or News signal moved, biggest move first. */
export function diffScores(before: SkillScore[], after: SkillScore[]): LiveChange[] {
  const old = new Map(before.map((s) => [s.skillId, s]));
  return after
    .flatMap((s): LiveChange[] => {
      const b = old.get(s.skillId);
      if (!b || (b.quadrant === s.quadrant && b.newsSignal === s.newsSignal)) return [];
      return [{ skillId: s.skillId, before: pick(b), after: pick(s) }];
    })
    .sort((x, y) => Number(y.before.quadrant !== y.after.quadrant) - Number(x.before.quadrant !== x.after.quadrant) ||
      y.after.newsSignal - y.before.newsSignal - (x.after.newsSignal - x.before.newsSignal));
}
