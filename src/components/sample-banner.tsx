/** Shown on every screen while the data is hand-made SAMPLE data, not a real pipeline run. */
export function SampleBanner({ mode }: { mode: "pipeline" | "sample" }) {
  if (mode !== "sample") return null;
  return (
    <div role="status" className="bg-sample text-sample-ink">
      <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs font-semibold tracking-wide sm:text-sm">
        SAMPLE DATA. Articles, job postings, and AI text below are made up for layout work.
        <span className="font-normal"> Real results replace them after </span>
        <code className="font-mono font-normal">npm run pipeline</code>.
      </p>
    </div>
  );
}
