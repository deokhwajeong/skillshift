/**
 * code-links.ts: "View code" links from the How it works screen to GitHub.
 *
 * One map for every link, so a shifted line range is a one-line fix here.
 * Each entry names the text its first line must contain (`starts`); the test in
 * tests/code-links.test.ts fails if a range drifts away from the code it points at.
 */

export const REPO_URL = "https://github.com/deokhwajeong/skillshift";
/** Branch the links open. Vercel deploys main, so the live site and the links match. */
export const REPO_BRANCH = "main";

export interface CodeLink {
  label: string;
  path: string;
  /** First and last line, inclusive. */
  lines: [number, number];
  /** Text that must appear on the first line (checked by a test). */
  starts: string;
}

/** Shared by every LLM stage: schema validation and the one retry. */
export const LLM_WRAPPER_LINKS: CodeLink[] = [
  { label: "Validation + one retry", path: "src/lib/llm.ts", lines: [89, 127], starts: "while (attempts < MAX_ATTEMPTS)" },
  { label: "validate()", path: "src/lib/llm.ts", lines: [143, 157], starts: "function validate" },
];

export const CODE_LINKS: Record<string, CodeLink[]> = {
  ingest: [{ label: "Ingest agent", path: "src/agents/ingest.ts", lines: [54, 69], starts: "export function ingest" }],
  filter: [
    { label: "Filter agent", path: "src/agents/filter.ts", lines: [33, 59], starts: "export async function runFilter" },
    { label: "Prompt", path: "src/agents/prompts/filter.ts", lines: [5, 36], starts: "export function filterSystemPrompt" },
    { label: "Orchestrator step", path: "src/pipeline/orchestrator.ts", lines: [82, 94], starts: "// 1. Filter" },
  ],
  extract: [
    { label: "Shift Extraction agent", path: "src/agents/shift-extraction.ts", lines: [29, 62], starts: "export async function runShiftExtraction" },
    { label: "Prompt", path: "src/agents/prompts/shift-extraction.ts", lines: [5, 37], starts: "export function shiftExtractionSystemPrompt" },
    { label: "Filter output becomes its input", path: "src/pipeline/orchestrator.ts", lines: [93, 105], starts: "const kept" },
  ],
  verify: [
    { label: "Verification agent", path: "src/agents/verification.ts", lines: [47, 91], starts: "export async function runVerification" },
    { label: "Editorial policy (publish or hold)", path: "src/pipeline/editorial.ts", lines: [31, 71], starts: "export function decide(" },
    { label: "If verification fails", path: "src/agents/verification.ts", lines: [94, 109], starts: "export function unverified" },
    { label: "Prompt", path: "src/agents/prompts/verification.ts", lines: [5, 40], starts: "export function verificationSystemPrompt" },
  ],
  jd: [
    { label: "JD Analyzer agent", path: "src/agents/jd-analyzer.ts", lines: [35, 71], starts: "export async function runJDAnalyzer" },
    { label: "Prompt", path: "src/agents/prompts/jd-analyzer.ts", lines: [5, 29], starts: "export function jdAnalyzerSystemPrompt" },
  ],
  score: [
    { label: "Signal Scorer", path: "src/scoring/signal-scorer.ts", lines: [99, 161], starts: "export function scoreSkills" },
    { label: "Quadrant rule", path: "src/scoring/signal-scorer.ts", lines: [81, 95], starts: "export function classify(" },
  ],
  brief: [
    { label: "Brief Writer agent", path: "src/agents/brief-writer.ts", lines: [100, 140], starts: "export async function runBriefWriter" },
    { label: "Which skills it writes about", path: "src/agents/brief-writer.ts", lines: [49, 55], starts: "export function selectBriefSkills" },
    { label: "Prompt", path: "src/agents/prompts/brief-writer.ts", lines: [5, 56], starts: "export function briefWriterSystemPrompt" },
  ],
  review: [
    { label: "Human decisions applied", path: "src/pipeline/editorial.ts", lines: [108, 129], starts: "export function applyDecisions" },
  ],
};

export const codeUrl = (link: CodeLink) =>
  `${REPO_URL}/blob/${REPO_BRANCH}/${link.path}#L${link.lines[0]}-L${link.lines[1]}`;
