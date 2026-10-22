/**
 * orchestrator.ts: runs the agents in order and collects their outputs.
 *
 *   Ingest -> Filter -> Shift Extraction -> Verification      (news side)
 *          -> JD Analyzer                                     (job side)
 *          -> Signal Scorer (code) -> Brief Writer            (both sides meet)
 *
 * Failure behavior: one item failing never stops the run. The item is skipped
 * (or, for verification, queued for a human) and recorded in `failures`.
 * The same function is used by `npm run pipeline` and, later, by Live mode.
 */
import { mapLimit } from "@/lib/concurrency";
import { AgentFailure, type Llm } from "@/lib/llm";
import type { IngestOutput } from "@/agents/ingest";
import { runFilter } from "@/agents/filter";
import { runShiftExtraction } from "@/agents/shift-extraction";
import { runVerification, unverified } from "@/agents/verification";
import { runJDAnalyzer } from "@/agents/jd-analyzer";
import { runBriefWriter, selectBriefSkills } from "@/agents/brief-writer";
import { scoreSkills } from "@/scoring/signal-scorer";
import { applyDecisions } from "./editorial";
import type {
  AgentRunLog,
  Article,
  ArticleCard,
  Brief,
  EditorQueueItem,
  FilterDecision,
  JDCard,
  JDSkillMention,
  JobDescription,
  PipelineFailure,
  Shift,
  SkillScore,
  StageSummary,
  VerifiedShift,
} from "./schemas";

export type StageId = "ingest" | "filter" | "extract" | "verify" | "jd" | "score" | "brief";

export interface ProgressEvent {
  stage: StageId;
  status: "start" | "done";
  message: string;
}

export interface PipelineOutput {
  role: string;
  generatedAt: string;
  stages: StageSummary[];
  filter: FilterDecision[];
  shifts: VerifiedShift[];
  queue: EditorQueueItem[];
  jdMentions: JDSkillMention[];
  /** JDs that were analyzed successfully (the JD signal denominator). */
  analyzedJdIds: string[];
  asOfDate: string;
  scores: SkillScore[];
  /** null when the Brief Writer failed; the matrix still works without it. */
  brief: Brief | null;
  failures: PipelineFailure[];
  runLog: AgentRunLog[];
}

export interface PipelineOptions {
  concurrency?: number;
  onProgress?: (event: ProgressEvent) => void;
}

export async function runPipeline(input: IngestOutput, llm: Llm, options: PipelineOptions = {}): Promise<PipelineOutput> {
  const { role, allSkills, roleSkills, scoring, articles, jds, decisions } = input;
  const limit = options.concurrency ?? 4;
  const progress = options.onProgress ?? (() => {});
  const failures: PipelineFailure[] = [];
  const recordFailure = (agent: string, itemId: string, error: unknown) => {
    failures.push({ agent, itemId, error: error instanceof Error ? error.message : String(error) });
    if (!(error instanceof AgentFailure)) console.error(error);
  };

  progress({ stage: "ingest", status: "done", message: `${articles.length} articles, ${jds.length} job descriptions` });

  // 1. Filter. Oldest first, so each article is checked for duplicates against earlier ones.
  progress({ stage: "filter", status: "start", message: `Scoring ${articles.length} articles for ${role.label} relevance` });
  const oldestFirst = [...articles].sort((a, b) => a.publishedDate.localeCompare(b.publishedDate) || a.id.localeCompare(b.id));
  const filter = await mapLimit(oldestFirst, limit, async (article, i): Promise<FilterDecision> => {
    try {
      return await runFilter(llm, { article, role, earlierArticles: oldestFirst.slice(0, i), editorial: scoring.editorial });
    } catch (error) {
      recordFailure("filter", article.id, error);
      return { articleId: article.id, keep: false, relevance: 0, reason: "Filter failed, so the article was left out.", duplicateOf: null };
    }
  });
  const kept = oldestFirst.filter((a) => filter.find((d) => d.articleId === a.id)?.keep);
  progress({ stage: "filter", status: "done", message: `${kept.length} of ${articles.length} kept` });

  // 2. Shift extraction, one call per kept article.
  progress({ stage: "extract", status: "start", message: `Extracting shifts from ${kept.length} articles` });
  const extracted = await mapLimit(kept, limit, async (article) => {
    try {
      return await runShiftExtraction(llm, { article, skills: allSkills });
    } catch (error) {
      recordFailure("shift-extraction", article.id, error);
      return [] as Shift[];
    }
  });
  const allShifts = extracted.flat();
  progress({ stage: "extract", status: "done", message: `${allShifts.length} shifts found` });

  // 3. Verification, one call per article, seeing other articles' shifts on the same skills.
  progress({ stage: "verify", status: "start", message: `Verifying ${allShifts.length} shifts` });
  const verifiedParts = await mapLimit(kept, limit, async (article, i) => {
    const own = extracted[i];
    const ownSkills = new Set(own.flatMap((s) => s.skillIds));
    const others = allShifts.filter((s) => s.articleId !== article.id && s.skillIds.some((id) => ownSkills.has(id)));
    try {
      return await runVerification(llm, { article, shifts: own, otherShifts: others, editorial: scoring.editorial });
    } catch (error) {
      recordFailure("verification", article.id, error);
      return unverified(own, article, error instanceof Error ? error.message : String(error));
    }
  });
  // Human decisions already made in the Editor Queue (data/editorial/decisions.json).
  const editorial = applyDecisions(
    verifiedParts.flatMap((p) => p.shifts),
    verifiedParts.flatMap((p) => p.queue),
    decisions,
  );
  const { shifts, queue } = editorial;
  const published = shifts.filter((s) => s.status === "published").length;
  const approved = editorial.approvedShiftIds.length;
  progress({ stage: "verify", status: "done", message: `${published} published (${approved} approved by an editor), ${shifts.length - published} in the Editor Queue` });

  // 4. JD analysis, one call per job description.
  progress({ stage: "jd", status: "start", message: `Analyzing ${jds.length} job descriptions` });
  let droppedForExcerpt = 0;
  const analyzedJdIds: string[] = [];
  const jdParts = await mapLimit(jds, limit, async (jd) => {
    try {
      const out = await runJDAnalyzer(llm, { jd, role, skills: roleSkills });
      droppedForExcerpt += out.droppedForExcerpt;
      analyzedJdIds.push(jd.id);
      return out.mentions;
    } catch (error) {
      recordFailure("jd-analyzer", jd.id, error);
      return [] as JDSkillMention[];
    }
  });
  const jdMentions = jdParts.flat();
  progress({ stage: "jd", status: "done", message: `${jdMentions.length} skill requirements found` });
  const okJdIds = jds.map((j) => j.id).filter((id) => analyzedJdIds.includes(id));

  // 5. Signal Scorer (code, no LLM). Only published shifts count.
  const articleCards = articles.map(articleCard);
  const { asOfDate, scores } = scoreSkills({
    role: role.id,
    skills: roleSkills,
    shifts,
    articles: articleCards,
    jdMentions,
    analyzedJdCount: okJdIds.length,
    config: scoring,
  });
  const shown = scores.filter((s) => s.quadrant !== "Quiet");
  progress({ stage: "score", status: "done", message: `${shown.length} of ${scores.length} skills placed on the matrix` });

  // 6. Brief Writer, from published evidence only.
  progress({ stage: "brief", status: "start", message: "Writing Today's Brief" });
  let brief: Brief | null = null;
  try {
    brief = await runBriefWriter(llm, {
      role,
      asOfDate,
      scores,
      shifts: shifts.filter((s) => s.status === "published"),
      articles: articleCards,
      jds: jds.map(jdCard),
      skills: roleSkills,
      config: scoring,
    });
  } catch (error) {
    recordFailure("brief-writer", role.id, error);
  }
  progress({ stage: "brief", status: "done", message: brief ? `${brief.items.length} brief items written` : "Brief unavailable" });

  const stages: StageSummary[] = [
    stage("ingest", "Ingest", false, articles.length + jds.length, articles.length + jds.length, `${articles.length} articles and ${jds.length} ${role.label} job descriptions loaded and validated`),
    stage("filter", "Filter", true, articles.length, kept.length, `${articles.length - kept.length} dropped as off topic or duplicate`),
    stage("extract", "Shift Extraction", true, kept.length, allShifts.length, `${allShifts.filter((s) => s.candidateSkill).length} proposed new skills`),
    stage("verify", "Verification", true, allShifts.length, published, `${shifts.length - published} shifts held for an editor; ${queue.length} queue items${approved ? `; ${approved} approved by an editor` : ""}`),
    stage("jd", "JD Analyzer", true, jds.length, jdMentions.length, `${droppedForExcerpt} mentions dropped because the excerpt was not in the posting`),
    stage("score", "Signal Scorer", false, roleSkills.length, shown.length, `${scores.length - shown.length} skills are Quiet (no strong signal)`),
    stage("brief", "Brief Writer", true, selectBriefSkills(scores).length, brief?.items.length ?? 0, `Every factual sentence cites a verified source`),
  ];

  return {
    role: role.id,
    generatedAt: new Date().toISOString(),
    stages,
    filter,
    shifts,
    queue,
    jdMentions,
    analyzedJdIds: okJdIds,
    asOfDate,
    scores,
    brief,
    failures,
    runLog: llm.logs,
  };
}

function stage(stageId: StageId, label: string, usesLlm: boolean, inCount: number, outCount: number, note: string): StageSummary {
  return { stage: stageId, label, usesLlm, inCount, outCount, note };
}

/** Article metadata safe to ship to the browser: no full text, just what cards need. */
export function articleCard(a: Article): ArticleCard {
  return { id: a.id, title: a.title, source: a.source, url: a.url, publishedDate: a.publishedDate, sourceType: a.sourceType, placeholder: a.placeholder };
}

/** JD metadata safe to ship to the browser. */
export function jdCard(j: JobDescription): JDCard {
  return { id: j.id, company: j.company, title: j.title, url: j.url, capturedDate: j.capturedDate, level: j.level, placeholder: j.placeholder };
}
