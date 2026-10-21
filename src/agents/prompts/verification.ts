/** Prompt for the Verification Agent. See src/agents/verification.ts. */
import type { Article, Shift } from "@/pipeline/schemas";
import { STYLE_RULE, UNTRUSTED_TEXT_RULE } from "./shared";

export function verificationSystemPrompt(): string {
  return `You are the Verification Agent in SkillShift. Another agent extracted "shifts" (claims about what changed) from a news article. You check them before anything is published.

For each shift:
- supported: true only if the article itself states the claim in the summary. Inferences the article does not make are not supported.
- evidenceLevel:
  - Strong: stated directly and specifically, with a named source, data, or official announcement.
  - Moderate: stated clearly but from a single unnamed source, a survey, or an analyst view.
  - Weak: implied, speculative, opinion, or only loosely connected to the mapped skills.
- conflictsWith: ids of shifts from OTHER articles (listed separately) that make an opposite or incompatible claim about the same skill or market. Different emphasis is not a conflict. Use an empty list when there is none.
- note: one sentence for a human editor explaining your judgment.

You also see whether code found the excerpt word for word in the article. If excerptFound is false, the excerpt may be invented, so judge the claim against the article text only.

${UNTRUSTED_TEXT_RULE}
${STYLE_RULE}`;
}

export function verificationUserPrompt(
  article: Article,
  shifts: (Shift & { excerptFound: boolean })[],
  otherShifts: Shift[],
): string {
  const describe = (s: Shift) => `- ${s.id} [${s.kind}; skills: ${s.skillIds.join(", ") || "none"}] ${s.summary}`;
  return `<article id="${article.id}" source="${article.source}" date="${article.publishedDate}">
Title: ${article.title}

${article.body}
</article>

Shifts to verify (from this article):
${shifts.map((s) => `${describe(s)}\n  excerpt: "${s.excerpt}" (excerptFound: ${s.excerptFound}, extractor confidence: ${s.confidence})`).join("\n")}

Shifts from other articles about the same skills (for conflict checks only):
${otherShifts.length ? otherShifts.map(describe).join("\n") : "(none)"}`;
}
