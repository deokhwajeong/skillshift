import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel } from "@/components/ai-label";
import { BriefCard } from "@/components/brief-card";
import { ExpansionPanel } from "@/components/expansion-panel";
import { ListenButton } from "@/components/listen-button";
import { MatrixSection } from "@/components/matrix-section";
import { briefScript } from "@/lib/brief-script";
import { getRoles, getScoringConfig, loadRoleData } from "@/lib/data";
import { loadTaxonomy } from "@/pipeline/loaders";
import type { RescoreInput } from "@/lib/rescore";
import { formatDate } from "@/lib/view";

/** Today: the date, the Signal Matrix (hero), and Today's Brief for one role. */
export default async function TodayPage({ params }: PageProps<"/[role]">) {
  const { role: roleId } = await params;
  const roles = getRoles();
  const role = roles.find((r) => r.id === roleId);
  if (!role) notFound();

  const data = loadRoleData(roleId);
  if (!data) {
    const skillCount = loadTaxonomy().skills.filter((s) => s.roles.includes(roleId)).length;
    return <ExpansionPanel role={role} roles={roles} skillCount={skillCount} />;
  }

  const config = getScoringConfig();
  const kept = data.filter.filter((f) => f.keep).length;
  const names = Object.fromEntries([...data.skills.values()].map((s) => [s.id, s.name]));
  const rescoreInput: RescoreInput = {
    role: roleId,
    skills: [...data.skills.values()],
    shifts: data.shifts,
    queue: data.queue,
    articles: data.articles,
    jdMentions: data.jdMentions,
    analyzedJdCount: data.summary.analyzedJdIds.length,
    config,
  };
  const expansion = roles.filter((r) => r.status === "expansion");

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby="matrix-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">
          {formatDate(data.asOfDate)} · {kept} articles · {data.summary.analyzedJdIds.length} job postings
        </p>
        <h1 id="matrix-title" className="mt-2 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] sm:text-5xl">
          Which {role.label} skills are moving, and do employers agree?
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-2">
          Each dot is a skill. Up means the news is talking about it; right means job postings already ask for it.
          The dashed lines are fixed thresholds, so the quadrant is a rule you can check, not a guess.
        </p>

        <MatrixSection input={rescoreInput} baseline={data.scores} names={names} />
      </section>

      <section aria-labelledby="brief-title">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-rule-strong pb-2">
          <div>
            <h2 id="brief-title" className="font-serif text-3xl font-semibold sm:text-4xl">
              Today&rsquo;s Brief
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Three shifts worth your week, written only from verified items. Bracketed numbers link to the sources.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {data.brief && data.brief.items.length > 0 && (
              <ListenButton lines={briefScript(data.brief, role.name, formatDate(data.brief.date))} />
            )}
            <AiLabel agent="Brief Writer" />
          </div>
        </div>
        {data.brief && data.brief.items.length > 0 ? (
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            {data.brief.items.map((item, i) => (
              <BriefCard key={item.headline} item={item} index={i} data={data} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-ink-2">
            No brief in this run (the Brief Writer failed or had nothing verified). The matrix above still works.
          </p>
        )}
      </section>

      {expansion.length > 0 && (
        <section aria-labelledby="expansion-title" className="border-t border-rule pt-6">
          <h2 id="expansion-title" className="text-xs font-semibold uppercase tracking-widest text-ink-3">
            More editions: team expansion
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {expansion.map((r) => (
              <Link key={r.id} href={`/${r.id}`} className="group rounded-md border border-dashed border-rule p-4 hover:border-ink">
                <p className="font-serif text-xl font-semibold group-hover:underline">{r.name}</p>
                <p className="mt-1 text-sm text-ink-2">{r.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
