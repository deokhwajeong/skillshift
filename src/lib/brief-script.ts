/**
 * brief-script.ts: turn Today's Brief into short lines for the browser to read
 * aloud. Citation markers like [news-01] are dropped (they are for eyes, not
 * ears). Pure function, tested in tests/audio.test.ts.
 */
import type { Brief } from "@/pipeline/schemas";

export interface ScriptLine {
  /** Which brief item this line belongs to, or null for the intro and sign-off. */
  item: number | null;
  text: string;
}

export const stripCitations = (text: string) =>
  text
    .replace(/\s*\[[^\]\s]+\]/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();

const ORDINAL = ["One", "Two", "Three"];

export function briefScript(brief: Brief, roleName: string, longDate: string): ScriptLine[] {
  const lines: ScriptLine[] = [
    { item: null, text: `SkillShift. Today's brief for ${roleName} candidates, ${longDate}. ${brief.items.length} shifts worth your week.` },
  ];
  brief.items.forEach((it, i) => {
    lines.push(
      { item: i, text: `${ORDINAL[i] ?? `Item ${i + 1}`}. ${it.headline}.` },
      { item: i, text: `What changed. ${stripCitations(it.whatChanged)}` },
      { item: i, text: `Why it matters. ${stripCitations(it.whyItMatters)}` },
      { item: i, text: `This week, learn this. ${it.whatToDo.learn}` },
      { item: i, text: `For your resume. ${it.whatToDo.resumeAngle}` },
      { item: i, text: `And prepare to answer: ${it.whatToDo.interviewQuestion}` },
    );
  });
  lines.push({ item: null, text: "That's the brief. The sources are linked on the page. This brief was written by an AI agent from verified items." });
  return lines;
}
