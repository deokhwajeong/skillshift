"use client";

/**
 * The Signal Matrix: a hand-built SVG 2x2 (no chart library).
 *   x = JD signal (share of job postings asking for the skill)
 *   y = News signal (recent, credible news coverage)
 * The dashed lines are the thresholds from config/scoring.json, so each dot
 * sits in the same quadrant the Signal Scorer assigned it.
 * Hover or focus a dot for its numbers; click it for the evidence.
 */
import Link from "next/link";
import { useState } from "react";
import type { Quadrant } from "@/pipeline/schemas";
import { FRAME, placeLabels, scaleX, scaleY } from "@/lib/matrix-layout";
import { QUADRANT_STYLE } from "./quadrant";

export interface MatrixPoint {
  id: string;
  name: string;
  quadrant: Quadrant;
  newsSignal: number;
  jdSignal: number;
  momentum: number;
  href: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const arrow = (m: number) => (m >= 0.25 ? " ↑" : m <= -0.25 ? " ↓" : "");

/** A skill's earlier position (before editor decisions or a live article), drawn faintly with a line to where it is now. */
export interface MatrixGhost {
  id: string;
  newsSignal: number;
  jdSignal: number;
}

export function SignalMatrix({
  points,
  newsStrong,
  jdStrong,
  ghosts = [],
}: {
  points: MatrixPoint[];
  newsStrong: number;
  jdStrong: number;
  ghosts?: MatrixGhost[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const f = FRAME;
  const x0 = scaleX(0);
  const x1 = scaleX(1);
  const y0 = scaleY(0);
  const y1 = scaleY(1);
  const tx = scaleX(jdStrong);
  const ty = scaleY(newsStrong);

  const byId = new Map(points.map((p) => [p.id, p]));

  const regions: { q: Quadrant | "low"; x: number; y: number; w: number; h: number }[] = [
    { q: "Emerging", x: x0, y: y1, w: tx - x0, h: ty - y1 },
    { q: "Rising", x: tx, y: y1, w: x1 - tx, h: ty - y1 },
    { q: "low", x: x0, y: ty, w: tx - x0, h: y0 - ty },
    { q: "Established", x: tx, y: ty, w: x1 - tx, h: y0 - ty },
  ];
  const corner = [
    { label: "Emerging", x: x0 + 10, y: y1 + 24, anchor: "start" as const, q: "Emerging" as const },
    { label: "Rising", x: x1 - 10, y: y1 + 24, anchor: "end" as const, q: "Rising" as const },
    { label: "Fading or Quiet", x: x0 + 10, y: ty + 26, anchor: "start" as const, q: "Fading" as const },
    { label: "Established", x: x1 - 10, y: ty + 26, anchor: "end" as const, q: "Established" as const },
  ];
  // Keep dot labels off the corner titles (serif 22px is about 11px per character).
  const reserved = corner.map((c) => {
    const w = c.label.length * 11;
    return { x: c.anchor === "start" ? c.x : c.x - w, y: c.y - 20, w, h: 26 };
  });

  const placed = placeLabels(
    points.map((p) => ({
      id: p.id,
      label: p.name + arrow(p.momentum),
      x: p.jdSignal,
      y: p.newsSignal,
      // News-driven quadrants get label room first, then Established, then Quiet.
      priority: { Rising: 20, Emerging: 20, Fading: 20, Established: 10, Quiet: 0 }[p.quadrant] + p.newsSignal + p.jdSignal,
    })),
    reserved,
  );
  const active = hover ? byId.get(hover) : undefined;
  const activePos = placed.find((p) => p.id === hover);
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${f.width} ${f.height}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Signal Matrix: ${points.length} skills plotted by JD signal and News signal`}
      >
        {/* Quadrant regions, tinted with the quadrant's color. */}
        {regions.map((r) => (
          <rect
            key={r.q}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            className={r.q === "low" ? "fill-ink" : QUADRANT_STYLE[r.q].fill}
            fillOpacity={r.q === "low" ? 0.03 : 0.08}
          />
        ))}
        {corner.map((c) => (
          <text
            key={c.label}
            x={c.x}
            y={c.y}
            textAnchor={c.anchor}
            className={`font-serif text-[22px] italic ${c.q === "Fading" ? "fill-ink-3" : QUADRANT_STYLE[c.q].fill}`}
          >
            {c.label}
          </text>
        ))}

        {/* Axes and ticks. */}
        <line x1={x0} y1={y0} x2={x1} y2={y0} className="stroke-ink-3" strokeWidth={1} />
        <line x1={x0} y1={y0} x2={x0} y2={y1} className="stroke-ink-3" strokeWidth={1} />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v} className="fill-ink-3 font-mono text-[11px]">
            <text x={scaleX(v)} y={y0 + 18} textAnchor="middle">
              {pct(v)}
            </text>
            <text x={x0 - 8} y={scaleY(v) + 4} textAnchor="end">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={(x0 + x1) / 2} y={f.height - 10} textAnchor="middle" className="fill-ink-2 text-[13px] font-medium">
          JD signal: share of job postings that ask for the skill {"→"}
        </text>
        <text
          transform={`translate(16 ${(y0 + y1) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-ink-2 text-[13px] font-medium"
        >
          News signal: recent, credible coverage {"→"}
        </text>

        {/* Thresholds from config/scoring.json. */}
        <line x1={tx} y1={y1} x2={tx} y2={y0} className="stroke-ink-2" strokeDasharray="4 4" strokeWidth={1} />
        <line x1={x0} y1={ty} x2={x1} y2={ty} className="stroke-ink-2" strokeDasharray="4 4" strokeWidth={1} />
        <text x={tx} y={y1 - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
          strong JD {pct(jdStrong)}
        </text>
        <text x={x1 - 2} y={ty - 5} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">
          strong news {newsStrong.toFixed(2)}
        </text>

        {/* Ghosts: where moved skills were before, with a line to where they are now. */}
        {ghosts.map((g) => {
          const p = byId.get(g.id);
          if (!p) return null;
          const gx = scaleX(g.jdSignal);
          const gy = scaleY(g.newsSignal);
          return (
            <g key={`ghost-${g.id}`} aria-hidden>
              <line x1={gx} y1={gy} x2={scaleX(p.jdSignal)} y2={scaleY(p.newsSignal)} className="stroke-accent" strokeWidth={1.5} strokeDasharray="3 3" />
              <circle cx={gx} cy={gy} r={6} className="fill-none stroke-accent" strokeWidth={1.5} strokeDasharray="2 2" />
            </g>
          );
        })}

        {/* Dots, Quiet first so named quadrants draw on top. */}
        {[...placed]
          .sort((a, b) => Number(byId.get(b.id)!.quadrant === "Quiet") - Number(byId.get(a.id)!.quadrant === "Quiet"))
          .map((pl) => {
            const p = byId.get(pl.id)!;
            const s = QUADRANT_STYLE[p.quadrant];
            const isHover = hover === p.id;
            const dim = hover !== null && !isHover;
            return (
              <Link
                key={p.id}
                href={p.href}
                aria-label={`${p.name}: ${p.quadrant}. News ${p.newsSignal.toFixed(2)}, JD ${pct(p.jdSignal)}`}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.id)}
                onBlur={() => setHover(null)}
                className="outline-none"
                style={{ opacity: dim ? 0.35 : 1, transition: "opacity 120ms" }}
              >
                <circle cx={pl.cx} cy={pl.cy} r={16} fill="transparent" />
                {p.quadrant === "Fading" ? (
                  <circle cx={pl.cx} cy={pl.cy} r={isHover ? 8 : 6} className={`fill-paper ${s.stroke}`} strokeWidth={2.5} />
                ) : (
                  <circle
                    cx={pl.cx}
                    cy={pl.cy}
                    r={(p.quadrant === "Quiet" ? 4 : 7) + (isHover ? 2 : 0)}
                    className={`${s.fill} stroke-paper`}
                    strokeWidth={2}
                  />
                )}
                {pl.label?.leaderTo != null && (
                  <line
                    x1={pl.cx}
                    y1={pl.cy + (pl.label.leaderTo < pl.cy ? -7 : 7)}
                    x2={pl.cx}
                    y2={pl.label.leaderTo}
                    className="max-sm:hidden stroke-ink-3"
                    strokeWidth={0.75}
                  />
                )}
                {pl.label && (
                  <text
                    x={pl.label.x}
                    y={pl.label.y}
                    textAnchor={pl.label.anchor}
                    className={`max-sm:hidden text-[12px] ${
                      p.quadrant === "Quiet" ? "fill-ink-3" : "fill-ink font-medium"
                    } ${isHover ? "underline" : ""}`}
                  >
                    {p.name + arrow(p.momentum)}
                  </text>
                )}
              </Link>
            );
          })}
      </svg>

      {active && activePos && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-56 rounded-md border border-rule bg-paper p-3 text-xs shadow-lg"
          style={{
            left: `${Math.min(80, Math.max(20, (activePos.cx / f.width) * 100))}%`,
            top: `${(activePos.cy / f.height) * 100}%`,
            transform: `translate(-50%, ${activePos.cy > f.height / 2 ? "calc(-100% - 14px)" : "14px"})`,
          }}
        >
          <p className="font-serif text-base font-semibold leading-tight text-ink">{active.name}</p>
          <p className="mt-0.5 font-semibold uppercase tracking-wider text-ink-2">{active.quadrant}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-ink-2">
            <dt>News</dt>
            <dd className="text-ink">{active.newsSignal.toFixed(2)}</dd>
            <dt>JD</dt>
            <dd className="text-ink">{pct(active.jdSignal)} of postings</dd>
            <dt>Momentum</dt>
            <dd className="text-ink">
              {active.momentum >= 0 ? "+" : ""}
              {active.momentum.toFixed(2)}
            </dd>
          </dl>
          <p className="mt-2 text-ink-3">Click for the evidence</p>
        </div>
      )}
    </div>
  );
}
