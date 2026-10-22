/**
 * Brief Writer Agent
 *
 * Purpose:   Write "Today's Brief" for one role: up to 3 items, each with
 *            What changed / Why it matters / What to do this week.
 * Input:     The role, the Signal Scorer output, PUBLISHED shifts, article and
 *            JD cards, the taxonomy, and config/scoring.json.
 * Output:    Brief { role, date, items[] }. Each item's `citations` are the
 *            source ids found in its text.
 * Uses LLM:  Yes, for the writing only. Code picks WHICH skills to write about
 *            (selectBriefSkills), and code checks every citation: each factual
 *            field must cite at least one source, every cited id must be in the
 *            evidence we provided, and no field may contain an em dash. A failed
 *            check goes back to the model through the one retry in llm.ts.
 * Failure:   Throws AgentFailure. The orchestrator records it and the app shows
 *            the matrix without a brief.
 */
import { z } from "zod";
import type { Llm } from "@/lib/llm";
import { modelFor } from "@/lib/llm";
import type {
  ArticleCard,
  Brief,
  BriefItem,
  JDCard,
  RoleConfig,
  ScoringConfig,
  Skill,
  SkillScore,
  VerifiedShift,
} from "@/pipeline/schemas";
import { explainScore } from "@/scoring/signal-scorer";
import { briefWriterSystemPrompt, briefWriterUserPrompt, type BriefEvidence } from "./prompts/brief-writer";
import { idEnum } from "./schema-helpers";

export const AGENT = "brief-writer";
const MAX_ITEMS = 3;

/** "[news-004]" style markers in a piece of text. */
export function citedIds(text: string): string[] {
  return [...text.matchAll(/\[([^\]\s]+)\]/g)].map((m) => m[1]);
}

/**
 * Which skills make the brief: news-driven quadrants first (Rising, Emerging,
 * then Fading), strongest news first. Established skills are table stakes,
 * not news, so they only fill empty slots.
 */
export function selectBriefSkills(scores: SkillScore[], max = MAX_ITEMS): SkillScore[] {
  const order = { Rising: 0, Emerging: 1, Fading: 2, Established: 3, Quiet: 4 } as const;
  return scores
    .filter((s) => s.quadrant !== "Quiet" && s.newsEvidence.length > 0)
    .sort((a, b) => order[a.quadrant] - order[b.quadrant] || b.newsSignal - a.newsSignal || a.skillId.localeCompare(b.skillId))
    .slice(0, max);
}

export interface BriefWriterInput {
  role: RoleConfig;
  asOfDate: string;
  scores: SkillScore[];
  shifts: VerifiedShift[];
  articles: ArticleCard[];
  jds: JDCard[];
  skills: Skill[];
  config: ScoringConfig;
}

export function buildBriefEvidence(input: BriefWriterInput): BriefEvidence[] {
  const article = new Map(input.articles.map((a) => [a.id, a]));
  const jd = new Map(input.jds.map((j) => [j.id, j]));
  const shift = new Map(input.shifts.map((s) => [s.id, s]));
  const skill = new Map(input.skills.map((s) => [s.id, s]));

  return selectBriefSkills(input.scores).map((score) => {
    // Cite at the article level: the reader clicks through to an article, not a shift.
    const news = score.newsEvidence.slice(0, 4).flatMap((shiftId) => {
      const s = shift.get(shiftId);
      const a = s && article.get(s.articleId);
      if (!s || !a) return [];
      return [{ id: a.id, title: a.title, source: a.source, date: a.publishedDate, summary: s.summary, excerpt: s.excerpt, evidenceLevel: s.verification.evidenceLevel }];
    });
    const jds = [...score.jdEvidence]
      .sort((x, y) => (x.requirement === y.requirement ? 0 : x.requirement === "required" ? -1 : 1))
      .slice(0, 3)
      .flatMap((m) => {
        const j = jd.get(m.jdId);
        return j ? [{ id: j.id, company: j.company, title: j.title, requirement: m.requirement, excerpt: m.excerpt }] : [];
      });
    return {
      skillId: score.skillId,
      skillName: skill.get(score.skillId)?.name ?? score.skillId,
      quadrant: score.quadrant,
      explanation: explainScore(score, input.config),
      news,
      jds,
    };
  });
}

export async function runBriefWriter(llm: Llm, input: BriefWriterInput): Promise<Brief> {
  const evidence = buildBriefEvidence(input);
  if (evidence.length === 0) return { role: input.role.id, date: input.asOfDate, items: [] };

  const allowed = new Set(evidence.flatMap((e) => [...e.news.map((n) => n.id), ...e.jds.map((j) => j.id)]));
  const item = z
    .object({
      skillIds: z.array(idEnum(evidence.map((e) => e.skillId))).min(1),
      headline: z.string().min(1),
      whatChanged: z.string().min(1),
      whyItMatters: z.string().min(1),
      whatToDo: z.object({ learn: z.string().min(1), resumeAngle: z.string().min(1), interviewQuestion: z.string().min(1) }),
    })
    .superRefine((it, ctx) => {
      for (const field of ["whatChanged", "whyItMatters"] as const) {
        const ids = citedIds(it[field]);
        if (ids.length === 0) ctx.addIssue({ code: "custom", path: [field], message: "must cite at least one source id in [brackets]" });
        for (const id of ids) {
          if (!allowed.has(id)) ctx.addIssue({ code: "custom", path: [field], message: `cites "${id}", which is not in the evidence` });
        }
      }
      if (JSON.stringify(it).includes("\u2014")) ctx.addIssue({ code: "custom", path: [], message: "contains an em dash; use a comma, colon, or period" });
    });
  const schema = z.object({ items: z.array(item).min(1).max(MAX_ITEMS) });

  const out = await llm.call({
    agent: AGENT,
    itemId: `${input.role.id}-${input.asOfDate}`,
    model: modelFor(AGENT),
    effort: "medium",
    system: briefWriterSystemPrompt(input.role),
    user: briefWriterUserPrompt(input.asOfDate, evidence),
    schema,
  });

  const items: BriefItem[] = out.items.map((it) => ({
    ...it,
    citations: [...new Set([...citedIds(it.whatChanged), ...citedIds(it.whyItMatters)])],
  }));
  return { role: input.role.id, date: input.asOfDate, items };
}
