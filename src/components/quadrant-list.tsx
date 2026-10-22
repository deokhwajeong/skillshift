import Link from "next/link";
import type { Quadrant, Skill, SkillScore } from "@/pipeline/schemas";
import { QUADRANTS, QUADRANT_BLURB } from "@/lib/view";
import { QuadrantMarker } from "./quadrant";

/**
 * The matrix as a list: every skill grouped by quadrant. It is the legend,
 * the text alternative for screen readers, and the main view on a phone.
 */
export function QuadrantList({ scores, skills, role }: { scores: SkillScore[]; skills: Map<string, Skill>; role: string }) {
  const groups = QUADRANTS.map((q) => ({
    q,
    items: scores.filter((s) => s.quadrant === q).sort((a, b) => b.newsSignal + b.jdSignal - (a.newsSignal + a.jdSignal)),
  }));
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-1">
      {groups.map(({ q, items }) => (
        <section key={q} aria-labelledby={`q-${q}`}>
          <h3 id={`q-${q}`} className="flex items-center gap-2 border-b border-rule pb-1">
            <QuadrantMarker quadrant={q as Quadrant} size={12} />
            <span className="font-serif text-lg font-semibold">{q}</span>
            <span className="ml-auto font-mono text-xs text-ink-3">{items.length}</span>
          </h3>
          <p className="mt-1 text-xs text-ink-3">{QUADRANT_BLURB[q]}</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {items.length === 0 && <li className="text-ink-3">None today</li>}
            {items.map((s) => (
              <li key={s.skillId}>
                <Link href={`/${role}/skills/${s.skillId}`} className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink">
                  {skills.get(s.skillId)?.name ?? s.skillId}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
