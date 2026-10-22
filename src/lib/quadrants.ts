/**
 * quadrants.ts: quadrant names and blurbs. A separate, dependency-free module so
 * browser components can import it without pulling in server code.
 */
import type { Quadrant } from "@/pipeline/schemas";

/** Order quadrants are listed in everywhere in the UI. */
export const QUADRANTS: Quadrant[] = ["Rising", "Emerging", "Established", "Fading", "Quiet"];

export const QUADRANT_BLURB: Record<Quadrant, string> = {
  Rising: "Strong in the news and in job descriptions",
  Emerging: "Strong in the news, few job descriptions yet",
  Established: "Asked for in job descriptions, quiet in the news",
  Fading: "News coverage dropping, few job descriptions",
  Quiet: "No strong signal either way",
};

