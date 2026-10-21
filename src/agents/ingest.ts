/**
 * Ingest Agent
 *
 * Purpose:   Load everything the pipeline needs for one role: config, taxonomy,
 *            curated news articles, and that role's job descriptions.
 * Input:     role id (e.g. "tpm"); files in config/ and data/raw/.
 * Output:    IngestOutput (below). Articles and JDs are normalized and validated
 *            by the schemas in src/pipeline/schemas.ts.
 * Uses LLM:  No.
 * Failure:   Any invalid file stops the run with one error listing every problem
 *            (DataValidationError). Bad input data is never half-processed.
 */
import {
  loadArticles,
  loadJobDescriptions,
  loadRoles,
  loadScoringConfig,
  loadTaxonomy,
  type DataPaths,
} from "@/pipeline/loaders";
import type { Article, JobDescription, RoleConfig, ScoringConfig, Skill } from "@/pipeline/schemas";

export interface IngestOutput {
  role: RoleConfig;
  /** Skills that apply to this role (used for JDs and filtering). */
  roleSkills: Skill[];
  /** The whole taxonomy (news shifts can map to any skill; roles are applied at scoring time). */
  allSkills: Skill[];
  scoring: ScoringConfig;
  articles: Article[];
  jds: JobDescription[];
}

/**
 * Where articles come from. Today only curated files are used. A live feed
 * (RSS, a news API) would implement this interface and feed the same pipeline.
 */
export interface SourceAdapter {
  name: string;
  fetchArticles(): Promise<Article[]>;
}

/** Placeholder for the future live feed. Intentionally not used by the pipeline. */
export const rssAdapter: SourceAdapter = {
  name: "rss",
  async fetchArticles() {
    throw new Error("RSS adapter is not implemented yet. This version uses curated files in data/raw/news/.");
  },
};

export function ingest(roleId: string, paths?: DataPaths): IngestOutput {
  const roles = loadRoles(paths);
  const role = roles.find((r) => r.id === roleId);
  if (!role) throw new Error(`Unknown role "${roleId}". Known roles: ${roles.map((r) => r.id).join(", ")}`);

  const taxonomy = loadTaxonomy(paths, roles);
  return {
    role,
    roleSkills: taxonomy.skills.filter((s) => s.roles.includes(roleId)),
    allSkills: taxonomy.skills,
    scoring: loadScoringConfig(paths),
    articles: loadArticles(paths),
    jds: loadJobDescriptions(roleId, paths),
  };
}
