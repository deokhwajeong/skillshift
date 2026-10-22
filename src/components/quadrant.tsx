import type { Quadrant } from "@/pipeline/schemas";

/** Tailwind classes per quadrant. Written out in full so Tailwind can find them. */
export const QUADRANT_STYLE: Record<Quadrant, { bg: string; text: string; border: string; fill: string; stroke: string }> = {
  Rising: { bg: "bg-rising", text: "text-rising", border: "border-rising", fill: "fill-rising", stroke: "stroke-rising" },
  Emerging: { bg: "bg-emerging", text: "text-emerging", border: "border-emerging", fill: "fill-emerging", stroke: "stroke-emerging" },
  Established: {
    bg: "bg-established",
    text: "text-established",
    border: "border-established",
    fill: "fill-established",
    stroke: "stroke-established",
  },
  Fading: { bg: "bg-fading", text: "text-fading", border: "border-fading", fill: "fill-fading", stroke: "stroke-fading" },
  Quiet: { bg: "bg-quiet", text: "text-quiet", border: "border-quiet", fill: "fill-quiet", stroke: "stroke-quiet" },
};

/** The marker used in the matrix, legend, and badges, so shape repeats the color's meaning. */
export function QuadrantMarker({ quadrant, size = 10 }: { quadrant: Quadrant; size?: number }) {
  const s = QUADRANT_STYLE[quadrant];
  const r = size / 2;
  return (
    <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {quadrant === "Fading" ? (
        <circle cx={r} cy={r} r={r - 1.25} className={`fill-none ${s.stroke}`} strokeWidth={2} />
      ) : quadrant === "Quiet" ? (
        <circle cx={r} cy={r} r={r / 2} className={s.fill} />
      ) : (
        <circle cx={r} cy={r} r={r} className={s.fill} />
      )}
    </svg>
  );
}

export function QuadrantBadge({ quadrant }: { quadrant: Quadrant }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink">
      <QuadrantMarker quadrant={quadrant} />
      {quadrant}
    </span>
  );
}
