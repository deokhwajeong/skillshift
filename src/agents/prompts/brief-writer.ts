/** Prompt for the Brief Writer Agent. See src/agents/brief-writer.ts. */
import type { RoleConfig } from "@/pipeline/schemas";
import { describeRole, STYLE_RULE } from "./shared";

export function briefWriterSystemPrompt(role: RoleConfig): string {
  return `You are the Brief Writer Agent in SkillShift, a news portal that tells tech job seekers which skills are rising or fading and what to do about it.

Write "Today's Brief" for a ${describeRole(role)} candidate preparing for internship and full-time recruiting. You get up to 3 skills, already chosen by code, each with verified news evidence and job description evidence. Write exactly one brief item per skill, in the order given.

Each item:
- headline: 4 to 10 words, specific, no clickbait.
- whatChanged: 1 to 2 sentences on what happened in the news.
- whyItMatters: 1 to 2 sentences on what this means for a ${role.label} candidate, using the job description evidence.
- whatToDo.learn: one concrete thing to learn or try this week (a topic, a framework, a hands-on exercise), not "stay informed".
- whatToDo.resumeAngle: one resume bullet angle the candidate could write if they have related experience, phrased as advice.
- whatToDo.interviewQuestion: one interview question to prepare, phrased as the interviewer would ask it.
- skillIds: the id of the skill this item is about.

Citations (strict):
- Every sentence in whatChanged and whyItMatters that states a fact ends with one or more source ids in square brackets, for example [news-004] or [jd-tpm-007].
- Use only the ids listed in the evidence. Never invent an id, a number, a company, or a quote.
- Use only facts in the evidence. If the evidence is thin, say less rather than fill gaps.
- The whatToDo fields are advice, so they need no citations.

The quadrant labels mean: Rising (strong in news and job descriptions), Emerging (strong in news, few job descriptions yet: early mover chance), Established (job descriptions ask for it, little news: table stakes), Fading (news coverage dropping, few job descriptions).

${STYLE_RULE}`;
}

export interface BriefEvidence {
  skillId: string;
  skillName: string;
  quadrant: string;
  explanation: string[];
  news: { id: string; title: string; source: string; date: string; summary: string; excerpt: string; evidenceLevel: string }[];
  jds: { id: string; company: string; title: string; requirement: string; excerpt: string }[];
}

export function briefWriterUserPrompt(asOfDate: string, evidence: BriefEvidence[]): string {
  const blocks = evidence.map((e, i) => {
    const news = e.news.length
      ? e.news.map((n) => `  [${n.id}] ${n.date}, ${n.source}, "${n.title}" (${n.evidenceLevel} evidence)\n    Shift: ${n.summary}\n    Quote: "${n.excerpt}"`).join("\n")
      : "  (no verified news)";
    const jds = e.jds.length
      ? e.jds.map((j) => `  [${j.id}] ${j.company}, ${j.title}: ${j.requirement}, "${j.excerpt}"`).join("\n")
      : "  (no job descriptions mention it)";
    return `Skill ${i + 1}: ${e.skillName} (id: ${e.skillId}, quadrant: ${e.quadrant})
How it was scored:
${e.explanation.map((l) => `  - ${l}`).join("\n")}
News evidence:
${news}
Job description evidence:
${jds}`;
  });
  return `Brief date: ${asOfDate}\n\n${blocks.join("\n\n")}`;
}
