/**
 * JD Analyzer Agent
 *
 * Purpose:   Find which taxonomy skills one job description asks for, and
 *            whether each is required or preferred.
 * Input:     JobDescription, the RoleConfig, and the skills for that role.
 * Output:    { mentions: JDSkillMention[], droppedForExcerpt: number }.
 *            At most one mention per skill; "required" wins over "preferred".
 * Uses LLM:  Yes. Code then drops any mention whose excerpt is not found word for
 *            word in the posting, so every JD signal is backed by real text.
 * Failure:   Throws AgentFailure. The orchestrator records it and the JD is left
 *            out of the JD signal (the denominator counts only analyzed JDs).
 */
import { z } from "zod";
import type { Llm } from "@/lib/llm";
import { modelFor } from "@/lib/llm";
import { containsExcerpt } from "@/lib/text";
import { Excerpt, Requirement, type JDSkillMention, type JobDescription, type RoleConfig, type Skill } from "@/pipeline/schemas";
import { jdAnalyzerSystemPrompt, jdAnalyzerUserPrompt } from "./prompts/jd-analyzer";
import { idEnum } from "./schema-helpers";

export const AGENT = "jd-analyzer";

export interface JDAnalyzerInput {
  jd: JobDescription;
  role: RoleConfig;
  skills: Skill[];
}

export interface JDAnalyzerOutput {
  mentions: JDSkillMention[];
  droppedForExcerpt: number;
}

export async function runJDAnalyzer(llm: Llm, input: JDAnalyzerInput): Promise<JDAnalyzerOutput> {
  const { jd, role, skills } = input;
  const schema = z.object({
    mentions: z.array(
      z.object({
        skillId: idEnum(skills.map((s) => s.id)),
        requirement: Requirement,
        excerpt: Excerpt,
      }),
    ),
  });

  const out = await llm.call({
    agent: AGENT,
    itemId: jd.id,
    model: modelFor(AGENT),
    effort: "medium",
    system: jdAnalyzerSystemPrompt(role, skills),
    user: jdAnalyzerUserPrompt(jd),
    schema,
  });

  // One mention per skill, required beats preferred.
  const bySkill = new Map<string, JDSkillMention>();
  let droppedForExcerpt = 0;
  for (const m of out.mentions) {
    if (!containsExcerpt(jd.body, m.excerpt)) {
      droppedForExcerpt++;
      continue;
    }
    const existing = bySkill.get(m.skillId);
    if (!existing || (existing.requirement === "preferred" && m.requirement === "required")) {
      bySkill.set(m.skillId, { jdId: jd.id, ...m });
    }
  }
  return { mentions: [...bySkill.values()], droppedForExcerpt };
}
