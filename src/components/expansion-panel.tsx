import Link from "next/link";
import type { RoleConfig } from "@/pipeline/schemas";

/** What a role without a dataset shows: the team expansion pitch, not an error. */
export function ExpansionPanel({ role, roles, skillCount }: { role: RoleConfig; roles: RoleConfig[]; skillCount: number }) {
  const full = roles.filter((r) => r.status === "full");
  return (
    <div className="mx-auto max-w-3xl py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Team expansion</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">{role.name}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        This edition is not staffed yet. In the team version, one member owns the {role.label} vertical: curating
        job postings, extending the taxonomy, and labeling the eval set.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["1. Add data", `Save 15 to 20 ${role.label} postings in data/raw/jds/${role.id}/.`],
          ["2. Tune taxonomy", `${skillCount} skills already list "${role.id}"; add what is missing in config/taxonomy.json.`],
          ["3. Run pipeline", `npm run pipeline writes data/generated/${role.id}/ and this page fills in. No code changes.`],
        ].map(([title, body]) => (
          <div key={title} className="rounded-md border border-rule p-4">
            <h2 className="font-serif text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-ink-2">{body}</p>
          </div>
        ))}
      </div>
      {full.length > 0 && (
        <p className="mt-8 text-sm text-ink-2">
          See a full edition:{" "}
          {full.map((r) => (
            <Link key={r.id} href={`/${r.id}`} className="font-semibold text-accent underline">
              {r.name}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
