"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section links under the masthead; the current section is underlined. */
export function NavLinks({ role }: { role: string }) {
  const pathname = usePathname();
  const links = [
    { href: `/${role}`, label: "Today", active: pathname === `/${role}` || pathname.startsWith(`/${role}/skills`) },
    { href: `/${role}/how-it-works`, label: "How it works", active: pathname.startsWith(`/${role}/how-it-works`) },
  ];
  return (
    <nav aria-label="Sections" className="flex gap-5 text-sm font-medium">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={`border-b-2 pb-0.5 ${l.active ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
