/**
 * Shift Extraction Agent
 *
 * Purpose:   Turn one kept article into "shifts": concrete changes in technology,
 *            practice, regulation, or the market, each mapped to taxonomy skills.
 * Input:     Article and the full skill taxonomy.
 * Output:    Shift[] (0 to 5). Each has a summary, a word-for-word excerpt
 *            (max 14 words), skillIds, an optional candidateSkill, and a confidence.
 * Uses LLM:  Yes. Shift ids ("<articleId>#s1") are assigned by code, not the model.
 *            skillIds are an enum in the schema, so the model cannot invent ids;
 *            a genuinely new skill goes in candidateSkill for human review.
 * Failure:   Throws AgentFailure. The orchestrator records it and the article
 *            contributes no shifts.
 */
import { z } from "zod";
import type { Llm } from "@/lib/llm";
import { modelFor } from "@/lib/llm";
import { CandidateSkill, Excerpt, Score01, type Article, type Shift, type Skill } from "@/pipeline/schemas";
import { shiftExtractionSystemPrompt, shiftExtractionUserPrompt } from "./prompts/shift-extraction";
import { idEnum } from "./schema-helpers";

export const AGENT = "shift-extraction";

export interface ShiftExtractionInput {
  article: Article;
  skills: Skill[];
}

export async function runShiftExtraction(llm: Llm, input: ShiftExtractionInput): Promise<Shift[]> {
  const { article, skills } = input;
  const schema = z.object({
    shifts: z
      .array(
        z.object({
          kind: z.enum(["technology", "practice", "regulation", "market"]),
          summary: z.string().min(1),
          excerpt: Excerpt,
          skillIds: z.array(idEnum(skills.map((s) => s.id))),
          candidateSkill: CandidateSkill.nullable(),
          confidence: Score01,
        }),
      )
      .max(5),
  });

  const out = await llm.call({
    agent: AGENT,
    itemId: article.id,
    model: modelFor(AGENT),
    effort: "medium",
    system: shiftExtractionSystemPrompt(skills),
    user: shiftExtractionUserPrompt(article),
    schema,
  });

  return out.shifts.map((s, i) => ({
    id: `${article.id}#s${i + 1}`,
    articleId: article.id,
    ...s,
    skillIds: [...new Set(s.skillIds)],
  }));
}
