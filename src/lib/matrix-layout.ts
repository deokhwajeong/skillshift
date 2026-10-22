/**
 * matrix-layout.ts: geometry for the hand-built SVG Signal Matrix.
 *
 * x = JD signal (hiring reality), y = News signal (what is changing).
 * Both run 0..1. The dashed threshold lines come from config/scoring.json,
 * so the quadrants on screen are exactly the ones the Signal Scorer used.
 *
 * Labels are placed greedily: for each point (strongest first) try a few
 * spots around the dot and keep the first that overlaps no other label or
 * dot and stays inside the plot. Labels stacked further away get a thin
 * leader line back to their dot. Points that find no spot keep only the dot
 * (hover still names them, and the list next to the chart has every skill). Pure code, unit tested in tests/view.test.ts.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlotFrame {
  width: number;
  height: number;
  /** Space around the plot for axes and titles. */
  pad: { top: number; right: number; bottom: number; left: number };
}

export const FRAME: PlotFrame = { width: 720, height: 520, pad: { top: 28, right: 24, bottom: 56, left: 64 } };

export function scaleX(v: number, f: PlotFrame = FRAME): number {
  return f.pad.left + v * (f.width - f.pad.left - f.pad.right);
}
export function scaleY(v: number, f: PlotFrame = FRAME): number {
  return f.height - f.pad.bottom - v * (f.height - f.pad.top - f.pad.bottom);
}

export interface PointIn {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Higher priority gets the best label spot. */
  priority: number;
}

export interface PlacedLabel {
  id: string;
  cx: number;
  cy: number;
  /** Text anchor point and alignment, or null when no spot was free (dot only). */
  label: { x: number; y: number; anchor: "start" | "end" | "middle"; leaderTo: number | null } | null;
}

const FONT_PX = 12;
/** Rough text width for a sans font at 12px; good enough to avoid collisions. */
export const textWidth = (s: string) => s.length * FONT_PX * 0.56;

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** `reserved` boxes (for example quadrant titles) are kept free of labels. */
export function placeLabels(points: PointIn[], reserved: Box[] = [], f: PlotFrame = FRAME, dotR = 7): PlacedLabel[] {
  const inner: Box = {
    x: f.pad.left + 2,
    y: f.pad.top + 2,
    w: f.width - f.pad.left - f.pad.right - 4,
    h: f.height - f.pad.top - f.pad.bottom - 4,
  };
  const dots: Box[] = points.map((p) => {
    const cx = scaleX(p.x, f);
    const cy = scaleY(p.y, f);
    return { x: cx - dotR, y: cy - dotR, w: dotR * 2, h: dotR * 2 };
  });
  const taken: Box[] = [...reserved];
  const result = new Map<string, PlacedLabel>();

  const order = [...points].sort((a, b) => b.priority - a.priority);
  for (const p of order) {
    const cx = scaleX(p.x, f);
    const cy = scaleY(p.y, f);
    const w = textWidth(p.label);
    const h = FONT_PX + 2;
    const gap = dotR + 4;
    type Spot = { box: Box; x: number; y: number; anchor: "start" | "end" | "middle"; leader: boolean };
    // Right, left, then rows above and below. Each row tries centered, then
    // starting at the dot, then ending at it. Rows past the first get a leader line.
    const spots: Spot[] = [
      { box: { x: cx + gap, y: cy - h / 2, w, h }, x: cx + gap, y: cy + 4, anchor: "start", leader: false },
      { box: { x: cx - gap - w, y: cy - h / 2, w, h }, x: cx - gap, y: cy + 4, anchor: "end", leader: false },
    ];
    for (let row = 1; row <= 7; row++) {
      const dy = gap + (row - 1) * h;
      for (const [top, ty] of [
        [cy - dy - h, cy - dy - 3],
        [cy + dy, cy + dy + h - 3],
      ]) {
        const leader = row > 1;
        spots.push({ box: { x: cx - w / 2, y: top, w, h }, x: cx, y: ty, anchor: "middle", leader });
        spots.push({ box: { x: cx - 4, y: top, w, h }, x: cx - 4, y: ty, anchor: "start", leader });
        spots.push({ box: { x: cx + 4 - w, y: top, w, h }, x: cx + 4, y: ty, anchor: "end", leader });
      }
    }
    const inside = (b: Box) => b.x >= inner.x && b.y >= inner.y && b.x + b.w <= inner.x + inner.w && b.y + b.h <= inner.y + inner.h;
    const free = spots.find((s) => inside(s.box) && !taken.some((t) => overlaps(t, s.box)) && !dots.some((d) => overlaps(d, s.box)));
    if (free) taken.push(free.box);
    result.set(p.id, {
      id: p.id,
      cx,
      cy,
      label: free ? { x: free.x, y: free.y, anchor: free.anchor, leaderTo: free.leader ? free.box.y + (free.box.y < cy ? h : 0) : null } : null,
    });
  }
  return points.map((p) => result.get(p.id)!);
}
