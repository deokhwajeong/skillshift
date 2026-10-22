/**
 * data.ts: read one role's pipeline output (data/generated/<role>/*.json) for the app.
 *
 * Server-side only (uses Node's fs). Pages are prerendered at build time, so the
 * demo never waits on an API: the browser only receives the finished HTML.
 *
 * Every file is validated with the same Zod schemas the pipeline wrote it with.
 * A role with no generated folder returns null and the UI shows its
 * "Team expansion" state instead of an error.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadRoles, loadScoringConfig, loadTaxonomy } from "@/pipeline/loaders";
import {
  AgentRunLog,
  ArticleCard,
  Brief,
  EditorQueueItem,
  FilterDecision,
  JDCard,
  JDSkillMention,
  LiveCacheFile,
  PipelineSummaryFile,
  ScoresFile,
  VerifiedShift,
  type RoleConfig,
  type Skill,
  type SkillScore,
} from "@/pipeline/schemas";

export interface RoleData {
  role: RoleConfig;
  summary: PipelineSummaryFile;
  articles: ArticleCard[];
  jds: JDCard[];
  filter: FilterDecision[];
  shifts: VerifiedShift[];
  queue: EditorQueueItem[];
  jdMentions: JDSkillMention[];
  asOfDate: string;
  scores: SkillScore[];
  brief: Brief | null;
  runLog: AgentRunLog[];
  /** Taxonomy skills for this role, by id. */
  skills: Map<string, Skill>;
}

function readFile<T>(dir: string, name: string, schema: z.ZodType<T>): T {
  const file = path.join(dir, name);
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new Error(`${file} does not match its schema: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export const getRoles = (): RoleConfig[] => loadRoles();
export const getScoringConfig = () => loadScoringConfig();

export function getRole(roleId: string): RoleConfig | undefined {
  return getRoles().find((r) => r.id === roleId);
}

export function generatedDir(roleId: string, root = process.cwd()): string {
  return path.join(root, "data", "generated", roleId);
}

/** null when the role is unknown or has no generated data yet. */
export function loadRoleData(roleId: string, root = process.cwd()): RoleData | null {
  const role = loadRoles({ root }).find((r) => r.id === roleId);
  const dir = generatedDir(roleId, root);
  if (!role || !fs.existsSync(path.join(dir, "pipeline-summary.json"))) return null;

  const scores = readFile(dir, "scores.json", ScoresFile);
  const taxonomy = loadTaxonomy({ root });
  return {
    role,
    summary: readFile(dir, "pipeline-summary.json", PipelineSummaryFile),
    articles: readFile(dir, "articles.json", z.array(ArticleCard)),
    jds: readFile(dir, "jds.json", z.array(JDCard)),
    filter: readFile(dir, "filter.json", z.array(FilterDecision)),
    shifts: readFile(dir, "shifts.json", z.array(VerifiedShift)),
    queue: readFile(dir, "editor-queue.json", z.array(EditorQueueItem)),
    jdMentions: readFile(dir, "jd-mentions.json", z.array(JDSkillMention)),
    asOfDate: scores.asOfDate,
    scores: scores.scores,
    brief: readFile(dir, "brief.json", Brief.nullable()),
    runLog: readFile(dir, "run-log.json", z.array(AgentRunLog)),
    skills: new Map(taxonomy.skills.filter((s) => s.roles.includes(roleId)).map((s) => [s.id, s])),
  };
}

/** The recorded Live mode run that the page replays when the API is unavailable, or null. */
export function loadLiveCache(roleId: string, root = process.cwd()): LiveCacheFile | null {
  const dir = generatedDir(roleId, root);
  if (!fs.existsSync(path.join(dir, "live-cache.json"))) return null;
  return readFile(dir, "live-cache.json", LiveCacheFile);
}
