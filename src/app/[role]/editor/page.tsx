import { notFound } from "next/navigation";
import { EditorQueue, type QueueEntry } from "@/components/editor-queue";
import { ExpansionPanel } from "@/components/expansion-panel";
import { getRoles, getScoringConfig, loadRoleData } from "@/lib/data";
import type { RescoreInput } from "@/lib/rescore";
import { loadEditorDecisions, loadTaxonomy } from "@/pipeline/loaders";

/** Editor Queue: items the editorial policy held back, waiting for a human. */
export default async function EditorPage({ params }: PageProps<"/[role]/editor">) {
  const { role: roleId } = await params;
  const roles = getRoles();
  const role = roles.find((r) => r.id === roleId);
  if (!role) notFound();
  const data = loadRoleData(roleId);
  if (!data) {
    const skillCount = loadTaxonomy().skills.filter((s) => s.roles.includes(roleId)).length;
    return <ExpansionPanel role={role} roles={roles} skillCount={skillCount} />;
  }

  const article = new Map(data.articles.map((a) => [a.id, a]));
  const shift = new Map(data.shifts.map((s) => [s.id, s]));
  const names = Object.fromEntries(loadTaxonomy().skills.map((s) => [s.id, s.name]));

  // One entry per held shift, with every queue item about it and the other side of any conflict.
  const shiftIds = [...new Set(data.queue.map((q) => q.shiftId))];
  const entries: QueueEntry[] = shiftIds.flatMap((id) => {
    const s = shift.get(id);
    const a = s && article.get(s.articleId);
    if (!s || !a) return [];
    const others = s.verification.conflictsWith.flatMap((otherId) => {
      const o = shift.get(otherId);
      const oa = o && article.get(o.articleId);
      return o && oa ? [{ shift: o, article: oa }] : [];
    });
    return [{ shift: s, article: a, items: data.queue.filter((q) => q.shiftId === id), others }];
  });

  const input: RescoreInput = {
    role: roleId,
    skills: [...data.skills.values()],
    shifts: data.shifts,
    queue: data.queue,
    articles: data.articles,
    jdMentions: data.jdMentions,
    analyzedJdCount: data.summary.analyzedJdIds.length,
    config: getScoringConfig(),
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Human in the loop</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">Editor Queue</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">
          AI does the reading; a human approves what gets published. These items were held back by the editorial
          policy (<code className="font-mono text-base">src/pipeline/editorial.ts</code>): low confidence, weak
          evidence, a conflict between sources, or a proposed new skill. A held shift counts once every item that held
          it is approved.
        </p>
      </div>
      <EditorQueue entries={entries} input={input} baseline={data.scores} names={names} fileDecisions={loadEditorDecisions()} />
    </div>
  );
}
