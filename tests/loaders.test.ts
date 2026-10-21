import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DataValidationError,
  loadArticles,
  loadJobDescriptions,
  loadRoles,
  loadScoringConfig,
  loadTaxonomy,
  type DataPaths,
} from "@/pipeline/loaders";

// Each test gets its own temp "repo" so tests never depend on the real data.
let paths: DataPaths;
const write = (rel: string, content: string) => {
  const file = path.join(paths.root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const repoRoot = path.resolve(__dirname, "..");
const copyRealConfig = () => {
  for (const name of ["roles.json", "taxonomy.json", "scoring.json"]) {
    write(`config/${name}`, fs.readFileSync(path.join(repoRoot, "config", name), "utf8"));
  }
};

const article = (id: string, date = "2026-10-14", extra = "") => `---
id: ${id}
title: "Test article ${id}"
source: Test Source
url: https://example.com/${id}
published_date: ${date}
source_type: trade
${extra}---

Body text for ${id}.
`;

beforeEach(() => {
  paths = { root: fs.mkdtempSync(path.join(os.tmpdir(), "skillshift-")) };
});
afterEach(() => {
  fs.rmSync(paths.root, { recursive: true, force: true });
});

describe("loadArticles", () => {
  it("parses front matter, normalizes fields, and sorts newest first", () => {
    write("data/raw/news/a.md", article("a", "2026-09-01"));
    write("data/raw/news/b.md", article("b", "2026-10-01"));
    const articles = loadArticles(paths);
    expect(articles.map((a) => a.id)).toEqual(["b", "a"]);
    expect(articles[0]).toMatchObject({
      publishedDate: "2026-10-01", // YAML Date object normalized to a string
      sourceType: "trade",
      placeholder: false,
      body: "Body text for b.",
      wordCount: 4,
      file: "data/raw/news/b.md",
    });
  });

  it("skips files that start with an underscore", () => {
    write("data/raw/news/_TEMPLATE.md", "not even valid front matter");
    write("data/raw/news/a.md", article("a"));
    expect(loadArticles(paths)).toHaveLength(1);
  });

  it("reports every problem across files in one error", () => {
    write("data/raw/news/bad-type.md", article("x").replace("source_type: trade", "source_type: tabloid"));
    write("data/raw/news/bad-url.md", article("y").replace("https://example.com/y", "not-a-url"));
    write("data/raw/news/extra-key.md", article("z", "2026-10-14", "author: someone\n"));
    try {
      loadArticles(paths);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DataValidationError);
      const issues = (e as DataValidationError).issues.join("\n");
      expect(issues).toContain("bad-type.md: source_type");
      expect(issues).toContain("bad-url.md: url");
      expect(issues).toContain("extra-key.md");
    }
  });

  it("rejects duplicate ids", () => {
    write("data/raw/news/a.md", article("same"));
    write("data/raw/news/b.md", article("same"));
    expect(() => loadArticles(paths)).toThrow(/duplicate id "same"/);
  });

  it("returns an empty list when the folder does not exist", () => {
    expect(loadArticles(paths)).toEqual([]);
  });
});

describe("loadJobDescriptions", () => {
  it("takes the role from the folder name", () => {
    write(
      "data/raw/jds/tpm/one.md",
      `---
id: jd-1
company: Test Co
title: TPM
url: https://example.com/jd-1
captured_date: 2026-10-20
level: L5
---

Required: 5+ years.
`,
    );
    const [jd] = loadJobDescriptions("tpm", paths);
    expect(jd).toMatchObject({ id: "jd-1", role: "tpm", capturedDate: "2026-10-20" });
    expect(loadJobDescriptions("pm", paths)).toEqual([]);
  });
});

describe("config loaders", () => {
  it("loads the real repo config without errors", () => {
    copyRealConfig();
    const roles = loadRoles(paths);
    expect(roles.find((r) => r.id === "tpm")?.status).toBe("full");
    expect(loadTaxonomy(paths, roles).skills.length).toBeGreaterThanOrEqual(15);
    expect(loadScoringConfig(paths).thresholds.jdStrong).toBeGreaterThan(0);
  });

  it("rejects a taxonomy that references an unknown role", () => {
    copyRealConfig();
    write(
      "config/taxonomy.json",
      JSON.stringify({
        version: 1,
        skills: [{ id: "x", name: "X", description: "d", aliases: [], roles: ["astronaut"] }],
      }),
    );
    expect(() => loadTaxonomy(paths)).toThrow(/unknown role "astronaut"/);
  });

  it("rejects an alias claimed by two skills", () => {
    copyRealConfig();
    const skill = (id: string, aliases: string[]) => ({ id, name: id, description: "d", aliases, roles: ["tpm"] });
    write("config/taxonomy.json", JSON.stringify({ version: 1, skills: [skill("a", ["GPU"]), skill("b", ["gpu"])] }));
    expect(() => loadTaxonomy(paths)).toThrow(/"gpu" is used by both "a" and "b"/);
  });

  it("rejects unknown keys in scoring.json so typos fail loudly", () => {
    copyRealConfig();
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, "config", "scoring.json"), "utf8"));
    config.thresholds.jdStrnog = 0.5;
    write("config/scoring.json", JSON.stringify(config));
    expect(() => loadScoringConfig(paths)).toThrow(DataValidationError);
  });
});

describe("real repo data", () => {
  it("loads the committed articles and TPM job descriptions", () => {
    const real = { root: repoRoot };
    expect(loadArticles(real).length).toBeGreaterThan(0);
    expect(loadJobDescriptions("tpm", real).length).toBeGreaterThan(0);
  });
});
