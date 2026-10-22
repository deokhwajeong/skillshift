import Link from "next/link";
import type { RoleConfig } from "@/pipeline/schemas";

/**
 * Role is a dimension of the data (data/generated/<role>/), not the product.
 * Roles without a dataset are "Team expansion": each team member would own one.
 */
export function RoleSelector({ roles, current }: { roles: RoleConfig[]; current: string }) {
  return (
    <nav aria-label="Role" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-ink-3">Role</span>
      {roles.map((r) => {
        const active = r.id === current;
        return (
          <Link
            key={r.id}
            href={`/${r.id}`}
            aria-current={active ? "page" : undefined}
            title={r.description}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
              active ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink hover:text-ink"
            }`}
          >
            {r.label}
            {r.status === "expansion" && (
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? "text-paper/70" : "text-ink-3"}`}>
                Team expansion
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
