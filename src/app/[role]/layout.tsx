import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel } from "@/components/ai-label";
import { NavLinks } from "@/components/nav-links";
import { RoleSelector } from "@/components/role-selector";
import { SampleBanner } from "@/components/sample-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { getRoles, loadRoleData } from "@/lib/data";

/** Every role gets a static page at build time; an unknown role is a 404 (notFound below). */
export function generateStaticParams() {
  return getRoles().map((r) => ({ role: r.id }));
}

export default async function RoleLayout({ children, params }: LayoutProps<"/[role]">) {
  const { role: roleId } = await params;
  const roles = getRoles();
  const role = roles.find((r) => r.id === roleId);
  if (!role) notFound();
  const data = loadRoleData(roleId);
  const mode = data?.summary.mode;
  // Items no human has decided yet (decisions from data/editorial/decisions.json are already in the queue file).
  const queueCount = data?.queue.filter((q) => !q.decision).length ?? 0;

  return (
    <>
      {mode && <SampleBanner mode={mode} />}
      <header className="mx-auto w-full max-w-6xl px-4 pt-4">
        <div className="flex items-center justify-between border-b border-rule pb-2 text-xs text-ink-3">
          <span className="uppercase tracking-widest">{role.name} edition</span>
          <ThemeToggle />
        </div>
        <div className="py-5 text-center sm:py-7">
          <Link href={`/${role.id}`} className="font-serif text-5xl font-semibold tracking-tight sm:text-7xl">
            SkillShift
          </Link>
          <p className="mt-2 font-serif text-base italic text-ink-2 sm:text-lg">
            Tech news, checked against what job postings actually ask for.
          </p>
        </div>
        <div className="flex flex-col gap-3 border-y-2 border-rule-strong py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <NavLinks role={role.id} queueCount={queueCount} />
          <RoleSelector roles={roles} current={role.id} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="flex flex-col gap-2 border-t border-rule pt-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-2">
            <AiLabel /> marks text written by an agent. Quoted excerpts are copied word for word from the linked source.
          </p>
          <p>Scores and quadrants are computed by code, not by an LLM.</p>
        </div>
      </footer>
    </>
  );
}
