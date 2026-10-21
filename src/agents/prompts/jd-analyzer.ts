/** Prompt for the JD Analyzer Agent. See src/agents/jd-analyzer.ts. */
import type { JobDescription, RoleConfig, Skill } from "@/pipeline/schemas";
import { describeRole, EXCERPT_RULE, renderTaxonomy, STYLE_RULE, UNTRUSTED_TEXT_RULE } from "./shared";

export function jdAnalyzerSystemPrompt(role: RoleConfig, skills: Skill[]): string {
  return `You are the JD Analyzer Agent in SkillShift. You read one ${describeRole(role)} job description and record which taxonomy skills it asks for.

For each taxonomy skill the posting asks for, return one mention:
- skillId: an id from the list below.
- requirement: "required" if it appears under required, minimum, or basic qualifications, or the responsibilities clearly depend on it. "preferred" if it appears under preferred, nice to have, or bonus qualifications.
- excerpt: the phrase from the posting that shows the requirement.

Only count a skill when the posting actually asks for it. Company boilerplate, benefits, and the "about us" section do not count. Give each skill at most one mention; if a skill is both required and preferred, report it as required.

${EXCERPT_RULE}
${UNTRUSTED_TEXT_RULE}
${STYLE_RULE}

Skill taxonomy:
${renderTaxonomy(skills)}`;
}

export function jdAnalyzerUserPrompt(jd: JobDescription): string {
  return `<job_description id="${jd.id}" company="${jd.company}" level="${jd.level}">
Title: ${jd.title}

${jd.body}
</job_description>`;
}
