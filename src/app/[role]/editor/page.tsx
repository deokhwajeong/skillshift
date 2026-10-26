import { notFound } from "next/navigation";
import { CodeLinks, SHOW_CODE_LINKS } from "@/components/code-links";
import { EditorQueue, type QueueEntry } from "@/components/editor-queue";
import { CODE_LINKS, LLM_WRAPPER_LINKS } from "@/lib/code-links";
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

  // Items an agent could not process even after its one retry (bad JSON twice, an API error).
  // Nothing from them is published; they are listed here so a human sees why.
  const itemTitle = (id: string) =>
    data.articles.find((a) => a.id === id)?.title ?? data.jds.find((j) => j.id === id)?.title ?? id;
  const failures = data.summary.failures;

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
      <section aria-labelledby="failures-title" className="border-t border-rule pt-6">
        <h2 id="failures-title" className="font-serif text-2xl font-semibold">
          Could not be checked
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          When an agent returns output that fails its schema, it gets the error back and one retry. If the retry fails
          too, the item is not published and lands here with the reason. A verification failure instead sends every
          shift from that article to the queue above.
        </p>
        {failures.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">None in this run: every agent call passed validation.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {failures.map((f) => (
              <li key={`${f.agent}-${f.itemId}`} className="rounded-md bg-paper-2 p-3">
                <span className="font-semibold">{itemTitle(f.itemId)}</span>
                <span className="block text-xs text-ink-3">
                  {f.agent}: {f.error}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {SHOW_CODE_LINKS && (
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <CodeLinks title="View code" links={[CODE_LINKS.verify[1], ...CODE_LINKS.review, CODE_LINKS.verify[2]]} />
          <CodeLinks title="LLM wrapper" links={LLM_WRAPPER_LINKS} />
        </div>
      )}
    </div>
  );
}
