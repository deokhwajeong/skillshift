/**
 * view.ts: turn a role's generated data into what each screen shows.
 *
 * Pure functions (no file or network access), so they are unit tested in
 * tests/view.test.ts. Screens call these and only render the result.
 */
import type {
  AgentRunLog,
  ArticleCard,
  BriefItem,
  EvidenceLevel,
  JDCard,
  JDSkillMention,
  ScoringConfig,
  VerifiedShift,
} from "@/pipeline/schemas";
import { buildBriefEvidence } from "@/agents/brief-writer";
import type { RoleData } from "./data";

export { QUADRANTS, QUADRANT_BLURB } from "./quadrants";

/** "2026-10-19" -> "Monday, October 19, 2026". UTC so the server's time zone never shifts the day. */
export function formatDate(iso: string, style: "long" | "short" = "long"): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...(style === "long"
      ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" }),
  });
}

// ---------------------------------------------------------------------------
// Today's Brief: citations
// ---------------------------------------------------------------------------

export interface Source {
  id: string;
  /** 1-based footnote number within one brief item. */
  n: number;
  kind: "news" | "jd";
  title: string;
  by: string;
  date: string;
  url: string;
}

/** The sources one brief item cites, numbered in the order they first appear. */
export function briefSources(item: BriefItem, data: Pick<RoleData, "articles" | "jds">): Source[] {
  const article = new Map(data.articles.map((a) => [a.id, a]));
  const jd = new Map(data.jds.map((j) => [j.id, j]));
  return item.citations.flatMap((id, i): Source[] => {
    const a = article.get(id);
    if (a) return [{ id, n: i + 1, kind: "news", title: a.title, by: a.source, date: a.publishedDate, url: a.url }];
    const j = jd.get(id);
    if (j) return [{ id, n: i + 1, kind: "jd", title: j.title, by: j.company, date: j.capturedDate, url: j.url }];
    return [];
  });
}

export type TextPart = { text: string } | { cite: string };

/** Split "A [news-01] and B [jd-02]." into text and citation parts for rendering. */
export function splitCitations(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(/\s*\[([^\]\s]+)\]/g)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ cite: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// ---------------------------------------------------------------------------
// Skill detail: evidence trail
// ---------------------------------------------------------------------------

export interface NewsEvidence {
  shift: VerifiedShift;
  article: ArticleCard;
}
export interface JDEvidence {
  mention: JDSkillMention;
  jd: JDCard;
}
export interface Conflict {
  shift: VerifiedShift;
  article: ArticleCard;
  other: NewsEvidence[];
  reason: string;
}

export interface SkillEvidence {
  news: NewsEvidence[];
  jd: JDEvidence[];
  conflicts: Conflict[];
  /** Shifts about this skill that wait in the Editor Queue and do not count yet. */
  pending: { shift: VerifiedShift; article: ArticleCard; reasons: string[] }[];
  /** How many counted shifts have each evidence level. */
  levels: Record<EvidenceLevel, number>;
  /** The best evidence level among counted shifts, or null when there are none. */
  overall: EvidenceLevel | null;
}

export function skillEvidence(data: RoleData, skillId: string): SkillEvidence {
  const score = data.scores.find((s) => s.skillId === skillId);
  const article = new Map(data.articles.map((a) => [a.id, a]));
  const jd = new Map(data.jds.map((j) => [j.id, j]));
  const shift = new Map(data.shifts.map((s) => [s.id, s]));
  const withArticle = (s: VerifiedShift | undefined): NewsEvidence[] => {
    const a = s && article.get(s.articleId);
    return s && a ? [{ shift: s, article: a }] : [];
  };

  const news = (score?.newsEvidence ?? []).flatMap((id) => withArticle(shift.get(id)));
  const jdItems = (score?.jdEvidence ?? []).flatMap((m): JDEvidence[] => {
    const j = jd.get(m.jdId);
    return j ? [{ mention: m, jd: j }] : [];
  });

  const about = data.shifts.filter((s) => s.skillIds.includes(skillId));
  const conflicts = about.flatMap((s): Conflict[] => {
    const ids = s.verification.conflictsWith;
    if (!ids.length) return [];
    const reason = data.queue.find((q) => q.shiftId === s.id && q.kind === "conflict")?.reason ?? s.verification.note;
    return withArticle(s).map((e) => ({ ...e, other: ids.flatMap((id) => withArticle(shift.get(id))), reason }));
  });
  const pending = about
    .filter((s) => s.status === "queued")
    .flatMap((s) =>
      withArticle(s).map((e) => ({ ...e, reasons: data.queue.filter((q) => q.shiftId === s.id).map((q) => q.reason) })),
    );

  const levels: Record<EvidenceLevel, number> = { Strong: 0, Moderate: 0, Weak: 0 };
  for (const { shift: s } of news) levels[s.verification.evidenceLevel]++;
  const overall = (["Strong", "Moderate", "Weak"] as const).find((l) => levels[l] > 0) ?? null;

  return { news, jd: jdItems, conflicts, pending, levels, overall };
}

// ---------------------------------------------------------------------------
// How it works: stage details and the cost and latency log
// ---------------------------------------------------------------------------

export interface StageInfo {
  stage: string;
  /** Which module does the work, so the demo can open the file. */
  file: string;
  prompt: string | null;
  /** The agent name in run-log.json, or null for code-only stages. */
  agent: string | null;
  /** What the in and out counts are counting. */
  units: [string, string];
  does: string;
}

export const STAGE_INFO: Record<string, StageInfo> = {
  ingest: {
    stage: "ingest",
    units: ["files", "loaded"],
    file: "src/agents/ingest.ts",
    prompt: null,
    agent: null,
    does: "Loads the curated Markdown articles and job descriptions, validates the front matter, and normalizes it.",
  },
  filter: {
    stage: "filter",
    units: ["articles", "kept"],
    file: "src/agents/filter.ts",
    prompt: "src/agents/prompts/filter.ts",
    agent: "filter",
    does: "Scores each article's relevance to hiring for the role and spots duplicates. Code makes the keep or drop call from a config threshold.",
  },
  extract: {
    stage: "extract",
    units: ["articles", "shifts"],
    file: "src/agents/shift-extraction.ts",
    prompt: "src/agents/prompts/shift-extraction.ts",
    agent: "shift-extraction",
    does: "Pulls out shifts (a technology, practice, regulation, or market change), maps them to taxonomy skills, and quotes a short excerpt.",
  },
  verify: {
    stage: "verify",
    units: ["shifts", "published"],
    file: "src/agents/verification.ts",
    prompt: "src/agents/prompts/verification.ts",
    agent: "verification",
    does: "Checks each shift against its article, flags conflicting claims, and assigns an evidence level. Weak or conflicting items wait for an editor.",
  },
  jd: {
    stage: "jd",
    units: ["postings", "skill mentions"],
    file: "src/agents/jd-analyzer.ts",
    prompt: "src/agents/prompts/jd-analyzer.ts",
    agent: "jd-analyzer",
    does: "Finds required and preferred skills in each job description. Code drops any excerpt that is not word for word in the posting.",
  },
  score: {
    stage: "score",
    units: ["skills", "in a quadrant"],
    file: "src/scoring/signal-scorer.ts",
    prompt: null,
    agent: null,
    does: "Plain TypeScript, no LLM: computes News signal, JD signal, and momentum, then picks the quadrant from fixed thresholds.",
  },
  brief: {
    stage: "brief",
    units: ["skills picked", "brief items"],
    file: "src/agents/brief-writer.ts",
    prompt: "src/agents/prompts/brief-writer.ts",
    agent: "brief-writer",
    does: "Writes Today's Brief from verified items only. Code picks the skills and checks that every factual sentence cites a source.",
  },
};

export interface AgentTotals {
  agent: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  ms: number;
  failed: number;
  retries: number;
}

export function runTotals(log: AgentRunLog[]): { byAgent: AgentTotals[]; total: AgentTotals } {
  const empty = (agent: string): AgentTotals => ({
    agent,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    ms: 0,
    failed: 0,
    retries: 0,
  });
  const byAgent = new Map<string, AgentTotals>();
  const total = empty("all");
  for (const row of log) {
    const t = byAgent.get(row.agent) ?? empty(row.agent);
    byAgent.set(row.agent, t);
    for (const acc of [t, total]) {
      acc.calls++;
      acc.inputTokens += row.inputTokens;
      acc.outputTokens += row.outputTokens;
      acc.cacheReadTokens += row.cacheReadTokens;
      acc.ms += row.ms;
      acc.failed += row.ok ? 0 : 1;
      acc.retries += row.retries;
    }
  }
  return { byAgent: [...byAgent.values()], total };
}

/** One real example of what a stage received and produced, taken from the generated data. */
export function stageSample(data: RoleData, stage: string, config: ScoringConfig): { input: unknown; output: unknown } {
  const firstKept = data.filter.find((f) => f.keep);
  const dropped = data.filter.find((f) => !f.keep);
  const article = (id?: string) => data.articles.find((a) => a.id === id);
  const shift = data.shifts.find((s) => s.articleId === firstKept?.articleId);
  const jd = data.jds.find((j) => data.jdMentions.some((m) => m.jdId === j.id));
  const topScore = [...data.scores].sort((a, b) => b.newsSignal + b.jdSignal - (a.newsSignal + a.jdSignal))[0];

  switch (stage) {
    case "ingest":
      return {
        input: `data/raw/news/*.md (${data.articles.length} files) and data/raw/jds/${data.role.id}/*.md (${data.jds.length} files): Markdown with YAML front matter`,
        output: { article: data.articles[0], jd: data.jds[0] },
      };
    case "filter":
      return {
        input: [article(firstKept?.articleId), article(dropped?.articleId)].filter(Boolean),
        output: [firstKept, dropped].filter(Boolean),
      };
    case "extract": {
      const shifts = data.shifts
        .filter((s) => s.articleId === firstKept?.articleId)
        // What the extractor returned, before verification added its fields.
        .map((s) => ({ id: s.id, kind: s.kind, summary: s.summary, excerpt: s.excerpt, skillIds: s.skillIds, candidateSkill: s.candidateSkill, confidence: s.confidence }));
      return { input: article(firstKept?.articleId), output: shifts };
    }
    case "verify": {
      const queued = data.shifts.find((s) => s.status === "queued");
      const pick = (s?: VerifiedShift) =>
        s && { shift: { id: s.id, summary: s.summary, excerpt: s.excerpt, skillIds: s.skillIds, confidence: s.confidence } };
      const result = (s?: VerifiedShift) =>
        s && { excerptFound: s.excerptFound, verification: s.verification, status: s.status };
      return { input: [pick(shift), pick(queued)].filter(Boolean), output: [result(shift), result(queued)].filter(Boolean) };
    }
    case "jd":
      return { input: jd, output: data.jdMentions.filter((m) => m.jdId === jd?.id) };
    case "score":
      return {
        input: topScore && { skillId: topScore.skillId, stats: topScore.stats, newsEvidence: topScore.newsEvidence },
        output: topScore && {
          newsSignal: topScore.newsSignal,
          jdSignal: topScore.jdSignal,
          momentum: topScore.momentum,
          quadrant: topScore.quadrant,
        },
      };
    case "brief": {
      // The exact evidence pack the Brief Writer prompt is built from (same function the agent calls).
      const evidence = buildBriefEvidence({
        role: data.role,
        asOfDate: data.asOfDate,
        scores: data.scores,
        shifts: data.shifts.filter((s) => s.status === "published"),
        articles: data.articles,
        jds: data.jds,
        skills: [...data.skills.values()],
        config,
      });
      return { input: evidence[0] ?? null, output: data.brief?.items[0] ?? null };
    }
    default:
      return { input: null, output: null };
  }
}
