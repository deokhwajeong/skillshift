/**
 * schemas.ts: the data contract for the whole pipeline.
 *
 * Every file on disk and every agent output is validated against one of these
 * Zod schemas. If an LLM returns something that does not match, we catch it
 * here instead of letting bad data reach the Signal Matrix.
 *
 * Conventions:
 * - Raw data files use snake_case front matter (easy to hand-edit).
 *   Loaders normalize it into the camelCase types below.
 * - Roles are plain string ids (e.g. "tpm") checked against config/roles.json,
 *   not a hard-coded enum, so adding a role needs no code change.
 */
import { z } from "zod";
import { countWords } from "@/lib/text";

/** UI excerpts must stay "under 15 words" (copyright and readability). */
export const MAX_EXCERPT_WORDS = 14;

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/**
 * YAML parses `2026-10-14` into a JS Date. We accept either a Date or a
 * string and always store the plain "YYYY-MM-DD" string.
 */
export const IsoDate = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a date like 2026-10-14"),
);

export const Excerpt = z
  .string()
  .min(1)
  .refine((s) => countWords(s) <= MAX_EXCERPT_WORDS, {
    message: `excerpt must be at most ${MAX_EXCERPT_WORDS} words`,
  });

export const Score01 = z.number().min(0).max(1);

export const SourceType = z.enum(["primary", "trade", "blog"]);
export const Quadrant = z.enum(["Rising", "Emerging", "Established", "Fading", "Quiet"]);
export const EvidenceLevel = z.enum(["Strong", "Moderate", "Weak"]);
export const Requirement = z.enum(["required", "preferred"]);

// ---------------------------------------------------------------------------
// Config files
// ---------------------------------------------------------------------------

export const RoleConfig = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  name: z.string(),
  /** "full" = has a dataset; "expansion" = shown as a team expansion card. */
  status: z.enum(["full", "expansion"]),
  description: z.string(),
});
export const RolesFile = z.object({ roles: z.array(RoleConfig).min(1) }).strict();

export const Skill = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "skill id must be kebab-case"),
  name: z.string().min(1),
  description: z.string().min(1),
  aliases: z.array(z.string()),
  roles: z.array(z.string()).min(1),
});
export const TaxonomyFile = z
  .object({ version: z.number().int(), skills: z.array(Skill).min(1) })
  .strict();

export const ScoringConfig = z
  .object({
    /** null = use the newest article date as "today". */
    asOfDate: IsoDate.nullable(),
    windows: z.object({ recentDays: z.number().positive(), earlierDays: z.number().positive() }).strict(),
    news: z
      .object({
        recencyHalfLifeDays: z.number().positive(),
        saturation: z.number().positive(),
        sourceWeights: z.object({ primary: Score01, trade: Score01, blog: Score01 }).strict(),
        evidenceWeights: z.object({ Strong: Score01, Moderate: Score01, Weak: Score01 }).strict(),
      })
      .strict(),
    jd: z.object({ requiredWeight: Score01, preferredWeight: Score01 }).strict(),
    thresholds: z
      .object({
        newsStrong: Score01,
        jdStrong: Score01,
        fadingMomentum: z.number().min(-1).max(0),
        minEarlierMentionsForFading: z.number().int().min(0),
      })
      .strict(),
    editorial: z
      .object({
        filterMinRelevance: Score01,
        publishMinConfidence: Score01,
      })
      .strict(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Raw inputs (front matter as written by a human)
// ---------------------------------------------------------------------------

export const ArticleFrontMatter = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    source: z.string().min(1),
    url: z.url(),
    published_date: IsoDate,
    source_type: SourceType,
    placeholder: z.boolean().default(false),
  })
  .strict();

export const JobDescriptionFrontMatter = z
  .object({
    id: z.string().min(1),
    company: z.string().min(1),
    title: z.string().min(1),
    url: z.url(),
    captured_date: IsoDate,
    level: z.string().min(1),
    placeholder: z.boolean().default(false),
  })
  .strict();

// ---------------------------------------------------------------------------
// Normalized inputs (what the Ingest Agent hands to the rest of the pipeline)
// ---------------------------------------------------------------------------

export const Article = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  url: z.url(),
  publishedDate: IsoDate,
  sourceType: SourceType,
  placeholder: z.boolean(),
  body: z.string().min(1),
  wordCount: z.number().int(),
  file: z.string(),
});

export const JobDescription = z.object({
  id: z.string(),
  role: z.string(),
  company: z.string(),
  title: z.string(),
  url: z.url(),
  capturedDate: IsoDate,
  level: z.string(),
  placeholder: z.boolean(),
  body: z.string().min(1),
  wordCount: z.number().int(),
  file: z.string(),
});

// ---------------------------------------------------------------------------
// Agent outputs (validated after every LLM call)
// ---------------------------------------------------------------------------

/** Filter Agent: one decision per article. */
export const FilterDecision = z.object({
  articleId: z.string(),
  keep: z.boolean(),
  relevance: Score01,
  reason: z.string().min(1),
  duplicateOf: z.string().nullable(),
});

/** A skill the model thinks is missing from the taxonomy. Goes to the Editor Queue. */
export const CandidateSkill = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

/** Shift Extraction Agent: a change in the world, tied to taxonomy skills. */
export const Shift = z.object({
  id: z.string(),
  articleId: z.string(),
  kind: z.enum(["technology", "practice", "regulation", "market"]),
  summary: z.string().min(1),
  excerpt: Excerpt,
  skillIds: z.array(z.string()),
  candidateSkill: CandidateSkill.nullable(),
  confidence: Score01,
});

/** JD Analyzer Agent: one skill requirement found in one job description. */
export const JDSkillMention = z.object({
  jdId: z.string(),
  skillId: z.string(),
  requirement: Requirement,
  excerpt: Excerpt,
});

/** Verification Agent: the model's judgment on one shift. */
export const VerificationResult = z.object({
  shiftId: z.string(),
  supported: z.boolean(),
  evidenceLevel: EvidenceLevel,
  conflictsWith: z.array(z.string()),
  note: z.string(),
});

/** A shift after verification, with the publish-or-queue decision made by code. */
export const VerifiedShift = Shift.extend({
  /** Code check: does the excerpt appear word for word in the article? */
  excerptFound: z.boolean(),
  verification: VerificationResult,
  status: z.enum(["published", "queued"]),
});

/** Editor Queue: items a human must approve before they count. */
export const EditorQueueItem = z.object({
  id: z.string(),
  kind: z.enum(["low-confidence", "conflict", "candidate-skill"]),
  shiftId: z.string(),
  reason: z.string(),
});

/** Article metadata safe to send to the browser (no full text). */
export const ArticleCard = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  url: z.url(),
  publishedDate: IsoDate,
  sourceType: SourceType,
  placeholder: z.boolean(),
});

/** Job description metadata safe to send to the browser (no full text). */
export const JDCard = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  url: z.url(),
  capturedDate: IsoDate,
  level: z.string(),
  placeholder: z.boolean(),
});

/** Signal Scorer (deterministic code, no LLM). */
export const SkillScore = z.object({
  skillId: z.string(),
  role: z.string(),
  newsSignal: Score01,
  jdSignal: Score01,
  momentum: z.number().min(-1).max(1),
  quadrant: Quadrant,
  /** The raw counts behind the numbers, so the UI can explain them in plain words. */
  stats: z.object({
    articles: z.number().int(),
    recentArticles: z.number().int(),
    earlierArticles: z.number().int(),
    newsWeight: z.number(),
    required: z.number().int(),
    preferred: z.number().int(),
    jdCount: z.number().int(),
  }),
  /** Published shift ids that mention this skill, newest first. */
  newsEvidence: z.array(z.string()),
  jdEvidence: z.array(JDSkillMention),
});

/** Brief Writer Agent: "Today's Brief" for one role. */
export const BriefItem = z.object({
  headline: z.string(),
  whatChanged: z.string(),
  whyItMatters: z.string(),
  whatToDo: z.object({
    learn: z.string(),
    resumeAngle: z.string(),
    interviewQuestion: z.string(),
  }),
  skillIds: z.array(z.string()),
  citations: z.array(z.string()).min(1),
});
export const Brief = z.object({
  role: z.string(),
  date: IsoDate,
  items: z.array(BriefItem).max(3),
});

/** Cost and latency log: one row per agent call. */
export const AgentRunLog = z.object({
  agent: z.string(),
  itemId: z.string(),
  model: z.string().nullable(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cacheReadTokens: z.number().int(),
  ms: z.number(),
  ok: z.boolean(),
  retries: z.number().int(),
});

/** One box on the "How it works" screen: what went in, what came out. */
export const StageSummary = z.object({
  stage: z.string(),
  label: z.string(),
  usesLlm: z.boolean(),
  inCount: z.number().int(),
  outCount: z.number().int(),
  note: z.string(),
});

/** An item an agent could not process. The run continues without it. */
export const PipelineFailure = z.object({
  agent: z.string(),
  itemId: z.string(),
  error: z.string(),
});

// ---------------------------------------------------------------------------
// Generated files (data/generated/<role>/), as written by src/pipeline/output.ts
// ---------------------------------------------------------------------------

export const ScoresFile = z.object({ asOfDate: IsoDate, scores: z.array(SkillScore) });

export const PipelineSummaryFile = z.object({
  /** "sample" = hand-made data for UI work; the UI shows a SAMPLE banner. */
  mode: z.enum(["pipeline", "sample"]),
  role: z.string(),
  generatedAt: z.string(),
  asOfDate: IsoDate,
  stages: z.array(StageSummary),
  analyzedJdIds: z.array(z.string()),
  failures: z.array(PipelineFailure),
});

// ---------------------------------------------------------------------------
// TypeScript types derived from the schemas (single source of truth)
// ---------------------------------------------------------------------------

export type RoleConfig = z.infer<typeof RoleConfig>;
export type Skill = z.infer<typeof Skill>;
export type Taxonomy = z.infer<typeof TaxonomyFile>;
export type ScoringConfig = z.infer<typeof ScoringConfig>;
export type Article = z.infer<typeof Article>;
export type JobDescription = z.infer<typeof JobDescription>;
export type FilterDecision = z.infer<typeof FilterDecision>;
export type Shift = z.infer<typeof Shift>;
export type JDSkillMention = z.infer<typeof JDSkillMention>;
export type VerificationResult = z.infer<typeof VerificationResult>;
export type VerifiedShift = z.infer<typeof VerifiedShift>;
export type EditorQueueItem = z.infer<typeof EditorQueueItem>;
export type StageSummary = z.infer<typeof StageSummary>;
export type PipelineFailure = z.infer<typeof PipelineFailure>;
export type SkillScore = z.infer<typeof SkillScore>;
export type ArticleCard = z.infer<typeof ArticleCard>;
export type JDCard = z.infer<typeof JDCard>;
export type BriefItem = z.infer<typeof BriefItem>;
export type Quadrant = z.infer<typeof Quadrant>;
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;
export type Brief = z.infer<typeof Brief>;
export type AgentRunLog = z.infer<typeof AgentRunLog>;
export type PipelineSummaryFile = z.infer<typeof PipelineSummaryFile>;
