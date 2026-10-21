/**
 * Filter Agent
 *
 * Purpose:   Score one article's relevance to hiring for the selected role and
 *            spot duplicates of articles already accepted.
 * Input:     Article, the RoleConfig, the articles published before it (oldest
 *            report of an event wins), and the editorial thresholds from
 *            config/scoring.json.
 * Output:    FilterDecision { articleId, keep, relevance, reason, duplicateOf }.
 * Uses LLM:  Yes, for relevance, reason, and duplicate detection. The keep/drop
 *            decision itself is code: keep = relevance >= filterMinRelevance
 *            AND not a duplicate. So the threshold is a config value we can explain.
 * Failure:   Throws AgentFailure. The orchestrator then drops the article and
 *            records why (we never publish what we could not check).
 */
import { z } from "zod";
import type { Llm } from "@/lib/llm";
import { modelFor } from "@/lib/llm";
import type { Article, FilterDecision, RoleConfig, ScoringConfig } from "@/pipeline/schemas";
import { Score01 } from "@/pipeline/schemas";
import { filterSystemPrompt, filterUserPrompt } from "./prompts/filter";
import { idEnum } from "./schema-helpers";

export const AGENT = "filter";

export interface FilterInput {
  article: Article;
  role: RoleConfig;
  earlierArticles: Article[];
  editorial: ScoringConfig["editorial"];
}

export async function runFilter(llm: Llm, input: FilterInput): Promise<FilterDecision> {
  const { article, role, earlierArticles, editorial } = input;
  const schema = z.object({
    relevance: Score01,
    reason: z.string().min(1),
    duplicateOf: earlierArticles.length ? idEnum(earlierArticles.map((a) => a.id)).nullable() : z.null(),
  });

  const out = await llm.call({
    agent: AGENT,
    itemId: article.id,
    model: modelFor(AGENT),
    effort: "low",
    maxTokens: 4000,
    system: filterSystemPrompt(role),
    user: filterUserPrompt(article, earlierArticles),
    schema,
  });

  return {
    articleId: article.id,
    keep: out.relevance >= editorial.filterMinRelevance && out.duplicateOf === null,
    relevance: out.relevance,
    reason: out.reason,
    duplicateOf: out.duplicateOf,
  };
}
