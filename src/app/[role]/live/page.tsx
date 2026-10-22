import { notFound } from "next/navigation";
import { ExpansionPanel } from "@/components/expansion-panel";
import { LiveMode } from "@/components/live-mode";
import { getRoles, getScoringConfig, loadLiveCache, loadRoleData } from "@/lib/data";
import { loadTaxonomy } from "@/pipeline/loaders";

/** Run live: paste one new article and watch it go through the agents. */
export default async function LivePage({ params }: PageProps<"/[role]/live">) {
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
  const names = Object.fromEntries(loadTaxonomy().skills.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Live mode</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">Run live</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">
          Paste one new article. It goes through the same Filter, Shift Extraction, and Verification agents as the
          offline pipeline, then the Signal Scorer shows how the matrix would move. Nothing is saved.
        </p>
      </div>
      <LiveMode
        role={roleId}
        names={names}
        cache={loadLiveCache(roleId)}
        newsStrong={config.thresholds.newsStrong}
        jdStrong={config.thresholds.jdStrong}
      />
    </div>
  );
}
