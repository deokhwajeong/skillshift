import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-3 px-4 py-24">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">404</p>
      <h1 className="font-serif text-4xl font-semibold">No such page in this edition.</h1>
      <Link href="/" className="text-accent underline">
        Back to Today
      </Link>
    </main>
  );
}
