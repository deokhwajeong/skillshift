/**
 * npm run sample
 *
 * Writes SAMPLE data to data/generated/tpm/ so the UI can be built before the
 * real pipeline runs. Everything here is invented and labeled as such:
 *   - article and JD titles start with "[SAMPLE]", sources and companies say "Sample"
 *   - all links point to example.com
 *   - pipeline-summary.json has mode: "sample", which the UI shows as a banner
 * The shifts and JD mentions are hand-written, but the matrix is computed by the
 * REAL Signal Scorer, so the UI shows exactly what real data would look like.
 * `npm run pipeline` overwrites all of it with real output.
 */
import { z } from "zod";
import { selectBriefSkills } from "@/agents/brief-writer";
import { ingest } from "@/agents/ingest";
import { writeGenerated } from "@/pipeline/output";
import {
  AgentRunLog,
  ArticleCard,
  Brief,
  EditorQueueItem,
  FilterDecision,
  JDCard,
  JDSkillMention,
  VerifiedShift,
  type EvidenceLevel,
  type Shift,
  type StageSummary,
} from "@/pipeline/schemas";
import { scoreSkills } from "@/scoring/signal-scorer";

const ROLE = "tpm";
const input = ingest(ROLE);

// ---------------------------------------------------------------------------
// Articles: [id suffix, date, source type, title]
// ---------------------------------------------------------------------------
const articleRows: [string, string, ArticleCard["sourceType"], string][] = [
  ["01", "2026-10-18", "primary", "Platform vendor makes evaluation reports mandatory for agent launches"],
  ["02", "2026-10-15", "trade", "New AI rules push companies to document model risk before release"],
  ["03", "2026-10-12", "trade", "GPU shortages force product teams to plan capacity a year ahead"],
  ["04", "2026-10-08", "primary", "Regulator issues guidance on consent for AI training data"],
  ["05", "2026-10-03", "blog", "Why every product team is suddenly hiring for AI agents"],
  ["06", "2026-09-28", "trade", "Teams treat LLM evals and tracing as release blockers"],
  ["07", "2026-09-10", "trade", "Inference bills become a board-level topic"],
  ["08", "2026-08-20", "primary", "Standards body publishes an AI management system checklist"],
  ["09", "2026-07-15", "trade", "Another consumer app retires its NFT marketplace"],
  ["10", "2026-06-02", "blog", "The quiet end of Web3 product teams"],
  ["11", "2026-05-10", "trade", "On-device AI arrives on smart TVs and set-top boxes"],
  ["12", "2026-04-22", "trade", "Crypto wallet integrations lose priority on app roadmaps"],
  ["13", "2026-10-19", "primary", "Cloud provider ties reserved accelerators to cost forecasts"],
  ["14", "2026-10-17", "blog", "Hands-on review of a new folding phone"],
  ["15", "2026-10-13", "trade", "GPU shortage means a year of capacity planning, analysts say"],
];
const sources: Record<ArticleCard["sourceType"], string> = {
  primary: "Sample Official Blog",
  trade: "Sample Tech Weekly",
  blog: "Sample Newsletter",
};
const articles: ArticleCard[] = articleRows.map(([n, date, type, title]) => ({
  id: `sample-news-${n}`,
  title: `[SAMPLE] ${title}`,
  source: sources[type],
  url: `https://example.com/sample/news-${n}`,
  publishedDate: date,
  sourceType: type,
  placeholder: true,
}));

const filter: FilterDecision[] = articles.map((a) => {
  if (a.id === "sample-news-14") return { articleId: a.id, keep: false, relevance: 0.1, reason: "Consumer product review with no effect on TPM skills.", duplicateOf: null };
  if (a.id === "sample-news-15") return { articleId: a.id, keep: false, relevance: 0.8, reason: "Reports the same GPU shortage story as an earlier article.", duplicateOf: "sample-news-03" };
  return { articleId: a.id, keep: true, relevance: 0.85, reason: "Describes a concrete change in what TPMs are asked to run.", duplicateOf: null };
});

// ---------------------------------------------------------------------------
// Shifts: [article, skills, kind, summary, excerpt (<= 14 words), evidence, confidence]
// ---------------------------------------------------------------------------
type Row = [string, string[], Shift["kind"], string, string, EvidenceLevel, number];
const shiftRows: Row[] = [
  ["01", ["llm-evaluation"], "practice", "A platform vendor now requires an evaluation report before any agent launch.", "agents cannot launch without a signed evaluation report", "Strong", 0.95],
  ["01", ["agentic-workflows"], "technology", "Agent features are moving from pilots to general availability.", "moving agent features from pilot to general availability", "Strong", 0.9],
  ["01", ["observability-reliability"], "practice", "Agent actions must be traceable after launch.", "every agent action must be traceable in production", "Moderate", 0.85],
  ["02", ["ai-governance-safety"], "regulation", "New rules require documented model risk assessments before release.", "documented risk assessment before a model reaches customers", "Strong", 0.92],
  ["02", ["llm-evaluation"], "regulation", "The rules expect evidence of testing for harmful output.", "evidence that outputs were tested for harm", "Moderate", 0.8],
  ["02", ["privacy-data-protection"], "regulation", "Risk assessments must cover personal data used by models.", "assessments must cover personal data used in training", "Moderate", 0.8],
  ["03", ["ai-compute-capacity"], "market", "Product teams must forecast GPU needs a year ahead.", "teams now forecast GPU needs twelve months ahead", "Strong", 0.9],
  ["03", ["cost-finops"], "market", "Capacity requests now need a budget owner.", "every capacity request needs a named budget owner", "Moderate", 0.8],
  ["04", ["privacy-data-protection"], "regulation", "A regulator says AI training on user data needs explicit consent.", "training on user data requires explicit and specific consent", "Strong", 0.94],
  ["04", ["ai-governance-safety"], "regulation", "Companies must keep records of training data decisions.", "keep records of how training data was selected", "Moderate", 0.82],
  ["05", ["agentic-workflows"], "market", "Product teams are opening roles focused on AI agents.", "nearly every team we spoke with is hiring for agents", "Strong", 0.8],
  ["06", ["llm-evaluation"], "practice", "Teams block releases that fail LLM evaluation suites.", "a failing eval suite now blocks the release", "Strong", 0.9],
  ["06", ["observability-reliability"], "practice", "Tracing LLM calls is now part of release readiness.", "tracing for model calls is part of release readiness", "Strong", 0.88],
  ["07", ["cost-finops"], "market", "Inference spend is reviewed at the board level.", "inference spend now appears in board reviews", "Strong", 0.9],
  ["07", ["ai-compute-capacity"], "market", "Companies are locking in multi-year accelerator contracts.", "companies are signing multi-year accelerator contracts", "Moderate", 0.8],
  ["08", ["ai-governance-safety"], "regulation", "A standards body published an AI management system checklist.", "a checklist for running an AI management system", "Strong", 0.92],
  ["08", ["privacy-data-protection"], "regulation", "The checklist includes data protection controls for AI.", "includes data protection controls for AI systems", "Strong", 0.88],
  ["09", ["web3-blockchain-platforms"], "market", "A consumer app is shutting down its NFT marketplace.", "the NFT marketplace will close at the end of the quarter", "Strong", 0.92],
  ["10", ["web3-blockchain-platforms"], "market", "Web3 product teams are being folded into AI teams.", "Web3 teams are being folded into AI groups", "Moderate", 0.8],
  ["11", ["edge-device-platforms", "ai-ml-platform-literacy"], "technology", "Smart TVs are starting to run AI models on the device.", "smart TVs now run small language models on the device", "Moderate", 0.82],
  ["12", ["web3-blockchain-platforms"], "market", "Crypto wallet integrations are dropping down app roadmaps.", "wallet integrations have dropped to the bottom of roadmaps", "Moderate", 0.8],
  ["13", ["ai-compute-capacity"], "market", "Reserved accelerators now require a cost forecast.", "reserved accelerators now require an approved cost forecast", "Strong", 0.93],
  ["13", ["cost-finops"], "market", "Inference costs per request are rising for large models.", "per-request inference costs rose for the largest models", "Moderate", 0.85],
];
const queuedRows: (Row & { 7?: never })[] = [
  ["06", ["experimentation-metrics"], "practice", "Some teams may replace A/B tests with offline evals.", "some teams may skip A/B tests entirely", "Weak", 0.55],
  ["07", ["cost-finops"], "market", "Inference prices will fall sharply next year.", "prices could fall by most of their value next year", "Weak", 0.6],
];

const shiftCounter = new Map<string, number>();
function makeShift(row: Row, status: VerifiedShift["status"], conflictsWith: string[] = [], candidate: Shift["candidateSkill"] = null): VerifiedShift {
  const [n, skillIds, kind, summary, excerpt, evidenceLevel, confidence] = row;
  const articleId = `sample-news-${n}`;
  const count = (shiftCounter.get(articleId) ?? 0) + 1;
  shiftCounter.set(articleId, count);
  const id = `${articleId}#s${count}`;
  return {
    id,
    articleId,
    kind,
    summary,
    excerpt,
    skillIds,
    candidateSkill: candidate,
    confidence,
    excerptFound: true,
    verification: { shiftId: id, supported: true, evidenceLevel, conflictsWith, note: `${evidenceLevel} evidence: stated in the article.` },
    status,
  };
}

const shifts = shiftRows.map((row) => makeShift(row, "published"));
// A published shift that also proposes a new skill for the taxonomy.
const agentHiring = shifts.find((s) => s.articleId === "sample-news-05")!;
agentHiring.candidateSkill = { name: "AI agent operations", description: "Runs agents in production: permissions, monitoring, and human handoff." };
// Two shifts that wait for an editor.
const lowConfidence = makeShift(queuedRows[0], "queued");
const conflicting = makeShift(queuedRows[1], "queued", [shifts.find((s) => s.articleId === "sample-news-13" && s.skillIds.includes("cost-finops"))!.id]);
shifts.push(lowConfidence, conflicting);

const queue: EditorQueueItem[] = [
  { id: `${agentHiring.id}:candidate-skill`, kind: "candidate-skill", shiftId: agentHiring.id, reason: `Proposed new skill "AI agent operations": Runs agents in production: permissions, monitoring, and human handoff.` },
  { id: `${lowConfidence.id}:low-confidence`, kind: "low-confidence", shiftId: lowConfidence.id, reason: "Extractor confidence 0.55 is below 0.7; evidence level is Weak" },
  { id: `${conflicting.id}:conflict`, kind: "conflict", shiftId: conflicting.id, reason: `Conflicts with ${conflicting.verification.conflictsWith[0]}. One source says inference prices will fall, another says per-request costs rose.` },
  { id: `${conflicting.id}:low-confidence`, kind: "low-confidence", shiftId: conflicting.id, reason: "Extractor confidence 0.60 is below 0.7; evidence level is Weak" },
];

// ---------------------------------------------------------------------------
// Job descriptions and their skill mentions: skill -> [required, preferred, phrase]
// ---------------------------------------------------------------------------
const areas = ["AI Platform", "Trust and Safety", "Content Platform", "Cloud Infrastructure", "Privacy Engineering", "Devices", "Ads Measurement", "Partner Integrations", "ML Infrastructure", "Payments", "Developer Platform", "Search Quality", "Data Platform", "Responsible AI", "Streaming Playback"];
const jds: JDCard[] = areas.map((area, i) => ({
  id: `sample-jd-${String(i + 1).padStart(2, "0")}`,
  company: `Sample Company ${String.fromCharCode(65 + i)}`,
  title: `[SAMPLE] Technical Program Manager, ${area}`,
  url: `https://example.com/sample/jobs/${i + 1}`,
  capturedDate: "2026-10-16",
  level: ["L5", "Senior", "L6", "Staff"][i % 4],
  placeholder: true,
}));

const jdPlan: Record<string, [number, number, string]> = {
  "cross-functional-leadership": [13, 1, "lead cross-functional teams across engineering, product, and legal"],
  "agile-program-execution": [12, 2, "drive roadmaps, dependencies, and risks across multiple teams"],
  "technical-writing": [9, 3, "write clear program plans and executive status updates"],
  "api-platform-integration": [7, 2, "manage API and platform integrations with external partners"],
  "privacy-data-protection": [6, 3, "experience running privacy programs such as GDPR or CCPA"],
  "partner-ecosystem-management": [6, 2, "own technical relationships with external partners"],
  "observability-reliability": [5, 2, "define SLOs and run incident reviews for production services"],
  "cloud-infrastructure": [5, 3, "experience with large-scale infrastructure on AWS, GCP, or Azure"],
  "llm-evaluation": [4, 5, "define evaluation and red teaming gates for AI features"],
  "ai-ml-platform-literacy": [4, 4, "understanding of ML training and serving platforms"],
  "edge-device-platforms": [4, 3, "experience shipping software on consumer devices"],
  "ai-governance-safety": [3, 6, "run AI governance reviews and model documentation"],
  "release-launch-management": [3, 2, "own launch readiness and staged rollouts"],
  "experimentation-metrics": [2, 3, "experience with A/B testing and success metrics"],
  "cost-finops": [2, 4, "lead cost reduction programs for cloud and inference spend"],
  "security-compliance": [2, 2, "coordinate security reviews and compliance certifications"],
  "ai-compute-capacity": [2, 1, "own GPU capacity forecasting with hardware teams"],
  "agentic-workflows": [1, 3, "experience shipping products built on AI agents"],
  "data-pipelines": [1, 2, "coordinate data pipeline and data quality work"],
  "web3-blockchain-platforms": [0, 1, "familiarity with blockchain or crypto wallet integrations"],
};
const jdMentions: JDSkillMention[] = [];
Object.entries(jdPlan).forEach(([skillId, [required, preferred, phrase]], k) => {
  for (let i = 0; i < required + preferred; i++) {
    const jd = jds[(k * 4 + i) % jds.length]; // spread each skill across different JDs
    jdMentions.push({ jdId: jd.id, skillId, requirement: i < required ? "required" : "preferred", excerpt: phrase });
  }
});

// ---------------------------------------------------------------------------
// Score with the real Signal Scorer, then a hand-written brief for the top 3.
// ---------------------------------------------------------------------------
const { asOfDate, scores } = scoreSkills({
  role: ROLE,
  skills: input.roleSkills,
  shifts,
  articles,
  jdMentions,
  analyzedJdCount: jds.length,
  config: input.scoring,
});
const byId = Object.fromEntries(scores.map((s) => [s.skillId, s]));
const jdOf = (skillId: string, i: number) => byId[skillId].jdEvidence[i].jdId;

const briefText: Record<string, Brief["items"][number]> = {
  "llm-evaluation": {
    skillIds: ["llm-evaluation"],
    headline: "Evaluation reports become a launch requirement",
    whatChanged: `A platform vendor now blocks agent launches without a signed evaluation report [sample-news-01], and teams treat failing eval suites as release blockers [sample-news-06].`,
    whyItMatters: `TPMs are the people who run launch gates, and postings already ask candidates to define evaluation and red teaming gates [${jdOf("llm-evaluation", 0)}][${jdOf("llm-evaluation", 1)}].`,
    whatToDo: {
      learn: "Build a 20-question eval set for any chatbot and track pass rate across two prompt versions.",
      resumeAngle: "Describe a quality gate you owned: what you measured, the threshold, and a launch you held or shipped because of it.",
      interviewQuestion: "How would you decide that an AI feature is ready to launch?",
    },
    citations: [],
  },
  "privacy-data-protection": {
    skillIds: ["privacy-data-protection"],
    headline: "Consent rules reach AI training data",
    whatChanged: `A regulator says training AI on user data requires explicit consent [sample-news-04], and new AI risk assessments must cover personal data [sample-news-02].`,
    whyItMatters: `Privacy program experience is already a common requirement in TPM postings [${jdOf("privacy-data-protection", 0)}][${jdOf("privacy-data-protection", 1)}], and AI makes it more central.`,
    whatToDo: {
      learn: "Map one AI feature's data flow: what personal data it touches, the consent basis, and retention.",
      resumeAngle: "Show a privacy or compliance program you drove across teams, with the regulation and the number of markets.",
      interviewQuestion: "Walk me through how you would get an AI feature through privacy review in multiple countries.",
    },
    citations: [],
  },
  "ai-governance-safety": {
    skillIds: ["ai-governance-safety"],
    headline: "Model risk documentation moves before release",
    whatChanged: `New rules require a documented risk assessment before a model reaches customers [sample-news-02], and a standards body published a checklist for running an AI management system [sample-news-08].`,
    whyItMatters: `Postings ask TPMs to run AI governance reviews and model documentation [${jdOf("ai-governance-safety", 0)}], work that sits between engineering, legal, and policy.`,
    whatToDo: {
      learn: "Read a published AI management system checklist and draft a one-page launch review template from it.",
      resumeAngle: "Frame a cross-functional review you ran (security, privacy, legal) as a governance process with clear gates.",
      interviewQuestion: "How would you set up an AI review process that does not slow every launch down?",
    },
    citations: [],
  },
  "observability-reliability": {
    skillIds: ["observability-reliability"],
    headline: "Tracing model calls joins release readiness",
    whatChanged: `Teams now include tracing for model calls in release readiness [sample-news-06], and every agent action must be traceable in production [sample-news-01].`,
    whyItMatters: `Reliability ownership is already a common TPM requirement [${jdOf("observability-reliability", 0)}], and AI features extend it to model behavior.`,
    whatToDo: {
      learn: "Sketch the SLOs you would set for an AI assistant: latency, error rate, and a quality signal.",
      resumeAngle: "Quantify an incident or reliability program you ran: SLOs, response time, and what changed after.",
      interviewQuestion: "What would you monitor after launching an AI agent, and what would trigger a rollback?",
    },
    citations: [],
  },
};

const selected = selectBriefSkills(scores);
const missing = selected.filter((s) => !briefText[s.skillId]);
if (missing.length) throw new Error(`Sample brief has no text for: ${missing.map((s) => s.skillId).join(", ")}`);
const citedIds = (t: string) => [...t.matchAll(/\[([^\]\s]+)\]/g)].map((m) => m[1]);
const brief: Brief = {
  role: ROLE,
  date: asOfDate,
  items: selected.map((s) => {
    const item = briefText[s.skillId];
    return { ...item, citations: [...new Set([...citedIds(item.whatChanged), ...citedIds(item.whyItMatters)])] };
  }),
};

// ---------------------------------------------------------------------------
// Stage counts and a cost/latency log shaped like a real run (numbers invented).
// ---------------------------------------------------------------------------
const kept = filter.filter((d) => d.keep).length;
const published = shifts.filter((s) => s.status === "published").length;
const shown = scores.filter((s) => s.quadrant !== "Quiet").length;
const stages: StageSummary[] = [
  { stage: "ingest", label: "Ingest", usesLlm: false, inCount: articles.length + jds.length, outCount: articles.length + jds.length, note: `${articles.length} articles and ${jds.length} TPM job descriptions loaded and validated` },
  { stage: "filter", label: "Filter", usesLlm: true, inCount: articles.length, outCount: kept, note: `${articles.length - kept} dropped as off topic or duplicate` },
  { stage: "extract", label: "Shift Extraction", usesLlm: true, inCount: kept, outCount: shifts.length, note: "1 proposed new skill" },
  { stage: "verify", label: "Verification", usesLlm: true, inCount: shifts.length, outCount: published, note: `${shifts.length - published} shifts held for an editor; ${queue.length} queue items` },
  { stage: "jd", label: "JD Analyzer", usesLlm: true, inCount: jds.length, outCount: jdMentions.length, note: "2 mentions dropped because the excerpt was not in the posting" },
  { stage: "score", label: "Signal Scorer", usesLlm: false, inCount: scores.length, outCount: shown, note: `${scores.length - shown} skills are Quiet (no strong signal)` },
  { stage: "brief", label: "Brief Writer", usesLlm: true, inCount: selected.length, outCount: brief.items.length, note: "Every factual sentence cites a verified source" },
];

const log = (agent: string, itemId: string, model: string, inputTokens: number, outputTokens: number, ms: number, retries = 0): AgentRunLog => ({
  agent, itemId, model, inputTokens, outputTokens, cacheReadTokens: Math.round(inputTokens * 0.6), ms, ok: true, retries,
});
const runLog: AgentRunLog[] = [
  ...articles.map((a, i) => log("filter", a.id, "claude-haiku-5-5", 1400 + i * 37, 90, 1200 + i * 40)),
  ...articles.filter((a) => filter.find((d) => d.articleId === a.id)!.keep).map((a, i) => log("shift-extraction", a.id, "claude-sonnet-5-5", 3100 + i * 55, 620, 6100 + i * 150, i === 4 ? 1 : 0)),
  ...articles.filter((a) => filter.find((d) => d.articleId === a.id)!.keep).map((a, i) => log("verification", a.id, "claude-sonnet-5-5", 2300 + i * 41, 380, 4200 + i * 120)),
  ...jds.map((j, i) => log("jd-analyzer", j.id, "claude-sonnet-5-5", 2900 + i * 23, 520, 5200 + i * 90)),
  log("brief-writer", `${ROLE}-${asOfDate}`, "claude-sonnet-5-5", 4100, 1400, 14800),
];

// Validate everything against the same schemas real data uses.
z.array(ArticleCard).parse(articles);
z.array(JDCard).parse(jds);
z.array(FilterDecision).parse(filter);
z.array(VerifiedShift).parse(shifts);
z.array(EditorQueueItem).parse(queue);
z.array(JDSkillMention).parse(jdMentions);
Brief.parse(brief);

const dir = writeGenerated(
  process.cwd(),
  {
    role: ROLE,
    generatedAt: new Date().toISOString(),
    stages,
    filter,
    shifts,
    queue,
    jdMentions,
    analyzedJdIds: jds.map((j) => j.id),
    asOfDate,
    scores,
    brief,
    failures: [],
    runLog,
    articles,
    jds,
  },
  "sample",
);

console.log(`SAMPLE data written to ${dir}/ (as of ${asOfDate})\n`);
for (const q of ["Rising", "Emerging", "Established", "Fading", "Quiet"] as const) {
  const list = scores.filter((s) => s.quadrant === q);
  console.log(`${q.padEnd(12)} ${list.map((s) => `${s.skillId} (news ${s.newsSignal.toFixed(2)}, jd ${s.jdSignal.toFixed(2)}, mom ${s.momentum.toFixed(2)})`).join("\n             ") || "(none)"}`);
}
console.log(`\nBrief: ${brief.items.map((i) => i.headline).join(" | ")}`);
