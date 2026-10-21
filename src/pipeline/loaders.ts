/**
 * loaders.ts: read config and raw data from disk and validate it.
 *
 * Server-side only (uses Node's fs). The browser never imports this file;
 * it reads the pipeline's output in data/generated/ instead.
 *
 * Failure behavior: loaders collect EVERY problem across all files and throw
 * one DataValidationError listing them, so fixing data is one pass, not ten.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { z } from "zod";
import { countWords } from "@/lib/text";
import {
  Article,
  ArticleFrontMatter,
  JobDescription,
  JobDescriptionFrontMatter,
  RolesFile,
  ScoringConfig,
  TaxonomyFile,
  type RoleConfig,
  type Taxonomy,
} from "./schemas";

export class DataValidationError extends Error {
  constructor(
    public readonly what: string,
    public readonly issues: string[],
  ) {
    super(`${what}: ${issues.length} problem(s)\n  - ${issues.join("\n  - ")}`);
    this.name = "DataValidationError";
  }
}

/** Where to find things. Tests pass a temp dir; everything else uses the repo root. */
export interface DataPaths {
  root: string;
}
const defaultPaths = (): DataPaths => ({ root: process.cwd() });

function formatZodIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${file}: ${i.path.join(".") || "(root)"}: ${i.message}`);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Markdown files to load: *.md, skipping templates and notes that start with "_". */
function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .sort()
    .map((name) => path.join(dir, name));
}

function findDuplicateIds(items: { id: string; file: string }[]): string[] {
  const seen = new Map<string, string>();
  const issues: string[] = [];
  for (const item of items) {
    const first = seen.get(item.id);
    if (first) issues.push(`${item.file}: duplicate id "${item.id}" (also in ${first})`);
    else seen.set(item.id, item.file);
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function loadRoles(paths: DataPaths = defaultPaths()): RoleConfig[] {
  const file = path.join(paths.root, "config", "roles.json");
  const parsed = RolesFile.safeParse(readJson(file));
  if (!parsed.success) throw new DataValidationError("roles.json", formatZodIssues(file, parsed.error));
  return parsed.data.roles;
}

export function loadTaxonomy(paths: DataPaths = defaultPaths(), roles = loadRoles(paths)): Taxonomy {
  const file = path.join(paths.root, "config", "taxonomy.json");
  const parsed = TaxonomyFile.safeParse(readJson(file));
  if (!parsed.success) throw new DataValidationError("taxonomy.json", formatZodIssues(file, parsed.error));

  // Cross-checks Zod cannot express: unique ids, unique aliases, known roles.
  const issues: string[] = [];
  const roleIds = new Set(roles.map((r) => r.id));
  const ids = new Set<string>();
  const names = new Map<string, string>(); // lowercased name or alias -> skill id

  for (const skill of parsed.data.skills) {
    if (ids.has(skill.id)) issues.push(`duplicate skill id "${skill.id}"`);
    ids.add(skill.id);
    for (const role of skill.roles) {
      if (!roleIds.has(role)) issues.push(`skill "${skill.id}" references unknown role "${role}"`);
    }
    for (const label of [skill.name, ...skill.aliases]) {
      const key = label.toLowerCase();
      const owner = names.get(key);
      if (owner && owner !== skill.id) issues.push(`"${label}" is used by both "${owner}" and "${skill.id}"`);
      names.set(key, skill.id);
    }
  }
  if (issues.length) throw new DataValidationError("taxonomy.json", issues);
  return parsed.data;
}

export function loadScoringConfig(paths: DataPaths = defaultPaths()): ScoringConfig {
  const file = path.join(paths.root, "config", "scoring.json");
  const parsed = ScoringConfig.safeParse(readJson(file));
  if (!parsed.success) throw new DataValidationError("scoring.json", formatZodIssues(file, parsed.error));
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Raw data
// ---------------------------------------------------------------------------

export function loadArticles(paths: DataPaths = defaultPaths()): Article[] {
  const dir = path.join(paths.root, "data", "raw", "news");
  const issues: string[] = [];
  const articles: Article[] = [];

  for (const file of listMarkdownFiles(dir)) {
    const rel = path.relative(paths.root, file).replaceAll("\\", "/");
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const fm = ArticleFrontMatter.safeParse(data);
    if (!fm.success) {
      issues.push(...formatZodIssues(rel, fm.error));
      continue;
    }
    const body = content.trim();
    const article = Article.safeParse({
      id: fm.data.id,
      title: fm.data.title.trim(),
      source: fm.data.source.trim(),
      url: fm.data.url,
      publishedDate: fm.data.published_date,
      sourceType: fm.data.source_type,
      placeholder: fm.data.placeholder,
      body,
      wordCount: countWords(body),
      file: rel,
    });
    if (article.success) articles.push(article.data);
    else issues.push(...formatZodIssues(rel, article.error));
  }

  issues.push(...findDuplicateIds(articles));
  if (issues.length) throw new DataValidationError("news articles", issues);
  // Newest first: the order every screen shows them in.
  return articles.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
}

export function loadJobDescriptions(role: string, paths: DataPaths = defaultPaths()): JobDescription[] {
  const dir = path.join(paths.root, "data", "raw", "jds", role);
  const issues: string[] = [];
  const jds: JobDescription[] = [];

  for (const file of listMarkdownFiles(dir)) {
    const rel = path.relative(paths.root, file).replaceAll("\\", "/");
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const fm = JobDescriptionFrontMatter.safeParse(data);
    if (!fm.success) {
      issues.push(...formatZodIssues(rel, fm.error));
      continue;
    }
    const body = content.trim();
    const jd = JobDescription.safeParse({
      id: fm.data.id,
      role, // role comes from the folder name, so one JD file cannot claim the wrong role
      company: fm.data.company.trim(),
      title: fm.data.title.trim(),
      url: fm.data.url,
      capturedDate: fm.data.captured_date,
      level: fm.data.level,
      placeholder: fm.data.placeholder,
      body,
      wordCount: countWords(body),
      file: rel,
    });
    if (jd.success) jds.push(jd.data);
    else issues.push(...formatZodIssues(rel, jd.error));
  }

  issues.push(...findDuplicateIds(jds));
  if (issues.length) throw new DataValidationError(`job descriptions (${role})`, issues);
  return jds;
}
