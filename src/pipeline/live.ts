/**
 * live.ts: Live mode. Runs ONE pasted article through the same agents as the
 * offline pipeline, then shows how the Signal Matrix would change.
 *
 *   Filter -> Shift Extraction -> Verification -> Signal Scorer (re-score)
 *
 * Input:     the pasted article (LiveArticleInput), the role's taxonomy and
 *            config, and the role's existing generated data (no full texts).
 * Output:    LiveResult, plus a LiveEvent for every step through `onEvent`,
 *            which the API route streams to the browser as it happens.
 * Uses LLM:  Yes, through the same agent modules (filter, shift extraction,
 *            verification). Scoring is the same pure-code Signal Scorer.
 * Failure:   A Filter or Shift Extraction failure throws (the route then
 *            shows the cached run). A Verification failure queues every shift
 *            for an editor instead, exactly like the offline pipeline.
 *
 * Nothing is saved: the live article only changes what this one result shows.
 */
import { runFilter } from "@/agents/filter";
import { runShiftExtraction } from "@/agents/shift-extraction";
import { runVerification, unverified } from "@/agents/verification";
import type { Llm } from "@/lib/llm";
import { resolveAsOfDate, scoreSkills } from "@/scoring/signal-scorer";
import type {
  Article,
  ArticleCard,
  JDSkillMention,
  LiveArticleInput,
  LiveEvent,
  LiveResult,
  RoleConfig,
  ScoringConfig,
  Skill,
  VerifiedShift,
} from "./schemas";
import { countWords } from "@/lib/text";
import { diffScores } from "@/lib/rescore";

export interface LiveContext {
  role: RoleConfig;
  /** Skills scored for this role. */
  roleSkills: Skill[];
  /** The whole taxonomy (shift extraction can map to any skill). */
  allSkills: Skill[];
  config: ScoringConfig;
  /** The role's current generated data. */
  articles: ArticleCard[];
  shifts: VerifiedShift[];
  jdMentions: JDSkillMention[];
  analyzedJdCount: number;
}

/** Stable id for a pasted article, so the same URL always gets the same id. */
export function liveArticleId(url: string): string {
  let h = 5381;
  for (const ch of url) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `live-${h.toString(36)}`;
}

export function toArticle(input: LiveArticleInput): Article {
  const id = liveArticleId(input.url);
  return { ...input, id, placeholder: false, wordCount: countWords(input.body), file: "(pasted in Live mode)" };
}

export async function runLive(
  input: LiveArticleInput,
  ctx: LiveContext,
  llm: Llm,
  onEvent: (e: LiveEvent) => void = () => {},
): Promise<LiveResult> {
  const article = toArticle(input);
  const card: ArticleCard = {
    id: article.id,
    title: article.title,
    source: article.source,
    url: article.url,
    publishedDate: article.publishedDate,
    sourceType: article.sourceType,
    placeholder: false,
  };
  const stage = (stage: string, status: "start" | "done", message: string) => onEvent({ type: "stage", stage, status, message });
  stage("ingest", "done", `Article received: ${article.wordCount} words from ${article.source}`);

  // Score both sides as of the same date, so any difference comes from this article alone.
  const asOfDate = resolveAsOfDate([...ctx.articles, card], { ...ctx.config, asOfDate: null });
  const config: ScoringConfig = {
    ...ctx.config,
    asOfDate: ctx.config.asOfDate && ctx.config.asOfDate > asOfDate ? ctx.config.asOfDate : asOfDate,
  };
  const score = (shifts: VerifiedShift[], articles: ArticleCard[]) =>
    scoreSkills({
      role: ctx.role.id,
      skills: ctx.roleSkills,
      shifts,
      articles,
      jdMentions: ctx.jdMentions,
      analyzedJdCount: ctx.analyzedJdCount,
      config,
    }).scores;
  const before = score(ctx.shifts, ctx.articles);

  // 1. Filter: every existing article counts as "earlier" for the duplicate check.
  stage("filter", "start", `Scoring relevance for ${ctx.role.label} and checking for duplicates`);
  const earlier: Article[] = ctx.articles.map((a) => ({ ...a, body: "", wordCount: 0, file: "" }));
  const filter = await runFilter(llm, { article, role: ctx.role, earlierArticles: earlier, editorial: config.editorial });
  stage(
    "filter",
    "done",
    filter.keep
      ? `Kept (relevance ${filter.relevance.toFixed(2)}): ${filter.reason}`
      : `Dropped (relevance ${filter.relevance.toFixed(2)}${filter.duplicateOf ? `, duplicate of ${filter.duplicateOf}` : ""}): ${filter.reason}`,
  );
  const empty = { shifts: [], queue: [] };
  if (!filter.keep) {
    stage("score", "done", "Nothing to re-score: the article was filtered out");
    return { article: card, filter, ...empty, asOfDate: config.asOfDate!, before, after: before, changes: [], runLog: llm.logs };
  }

  // 2. Shift extraction.
  stage("extract", "start", "Extracting shifts and mapping them to taxonomy skills");
  const extracted = await runShiftExtraction(llm, { article, skills: ctx.allSkills });
  // The LLM wrapper validates the output against the schema and retries once if it fails.
  const retries = llm.logs.filter((l) => l.agent === "shift-extraction").reduce((n, l) => n + l.retries, 0);
  stage(
    "extract",
    "done",
    `${extracted.length} shift(s) found${retries ? "; the first answer failed schema validation and passed on its one retry" : ", output passed schema validation"}`,
  );

  // 3. Verification against the article and against existing shifts on the same skills.
  stage("verify", "start", `Checking ${extracted.length} shift(s) against the article and ${ctx.shifts.length} existing shifts`);
  const skills = new Set(extracted.flatMap((s) => s.skillIds));
  const others = ctx.shifts.filter((s) => s.skillIds.some((id) => skills.has(id)));
  let verified: { shifts: VerifiedShift[]; queue: LiveResult["queue"] };
  try {
    verified = await runVerification(llm, { article, shifts: extracted, otherShifts: others, editorial: config.editorial });
  } catch (error) {
    verified = unverified(extracted, article, error instanceof Error ? error.message : String(error));
  }
  const published = verified.shifts.filter((s) => s.status === "published").length;
  stage("verify", "done", `${published} published, ${verified.shifts.length - published} would wait for an editor`);

  // 4. Re-score with the new published shifts (code, no LLM).
  const after = score([...ctx.shifts, ...verified.shifts], [...ctx.articles, card]);
  const changes = diffScores(before, after);
  const moved = changes.filter((c) => c.before.quadrant !== c.after.quadrant).length;
  stage("score", "done", `${changes.length} skill score(s) changed, ${moved} moved quadrant`);

  return { article: card, filter, ...verified, asOfDate: config.asOfDate!, before, after, changes, runLog: llm.logs };
}
