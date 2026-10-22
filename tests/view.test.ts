import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRoleData } from "@/lib/data";
import { FRAME, overlaps, placeLabels, textWidth } from "@/lib/matrix-layout";
import { briefSources, runTotals, skillEvidence, splitCitations, STAGE_INFO, stageSample } from "@/lib/view";
import { loadScoringConfig } from "@/pipeline/loaders";

// Scenario tests run on a frozen copy of the SAMPLE data (tests/fixtures/sample),
// so they keep passing after npm run pipeline replaces data/generated/.
const FIXTURE = path.resolve(__dirname, "fixtures", "sample");
const data = loadRoleData("tpm", FIXTURE)!;

describe("loadRoleData", () => {
  it("loads and validates every committed generated file for a full role (real or sample)", () => {
    const live = loadRoleData("tpm");
    expect(live).not.toBeNull();
    expect(live!.scores.length).toBeGreaterThan(0);
    expect(live!.summary.stages.map((s) => s.stage)).toEqual(["ingest", "filter", "extract", "verify", "jd", "score", "brief"]);
  });

  it("returns null for a team expansion role with no data", () => {
    expect(loadRoleData("pm")).toBeNull();
    expect(loadRoleData("not-a-role")).toBeNull();
  });
});

describe("Today's Brief citations", () => {
  it("splits [id] markers out of the text", () => {
    expect(splitCitations("A rule [news-01], and more [jd-02].")).toEqual([
      { text: "A rule" },
      { cite: "news-01" },
      { text: ", and more" },
      { cite: "jd-02" },
      { text: "." },
    ]);
  });

  it("numbers sources in citation order and resolves news and JDs", () => {
    const item = data.brief!.items[0];
    const sources = briefSources(item, data);
    expect(sources.map((s) => s.n)).toEqual(item.citations.map((_, i) => i + 1));
    expect(sources.every((s) => s.url.startsWith("http"))).toBe(true);
    expect(new Set(sources.map((s) => s.kind))).toEqual(new Set(["news", "jd"]));
  });
});

describe("skillEvidence", () => {
  it("collects news, JD excerpts, the conflict, and the queued item for a skill", () => {
    const ev = skillEvidence(data, "cost-finops");
    const score = data.scores.find((s) => s.skillId === "cost-finops")!;
    expect(ev.news).toHaveLength(score.newsEvidence.length);
    expect(ev.jd).toHaveLength(score.jdEvidence.length);
    expect(ev.conflicts).toHaveLength(1);
    expect(ev.conflicts[0].other).toHaveLength(1);
    expect(ev.pending).toHaveLength(1);
    expect(ev.levels.Strong + ev.levels.Moderate + ev.levels.Weak).toBe(ev.news.length);
    expect(ev.overall).toBe("Strong");
  });

  it("has no evidence level when no verified news mentions the skill", () => {
    const ev = skillEvidence(data, "cross-functional-leadership");
    expect(ev.news).toHaveLength(0);
    expect(ev.overall).toBeNull();
  });
});

describe("How it works", () => {
  it("sums the run log per agent and in total", () => {
    const { byAgent, total } = runTotals(data.runLog);
    expect(total.calls).toBe(data.runLog.length);
    expect(byAgent.reduce((n, a) => n + a.inputTokens, 0)).toBe(total.inputTokens);
  });

  it("has a description and a sample input and output for every stage", () => {
    const config = loadScoringConfig({ root: FIXTURE });
    for (const stage of data.summary.stages) {
      expect(STAGE_INFO[stage.stage], stage.stage).toBeDefined();
      const sample = stageSample(data, stage.stage, config);
      expect(sample.input, stage.stage).toBeTruthy();
      expect(sample.output, stage.stage).toBeTruthy();
    }
  });
});

describe("placeLabels", () => {
  it("never overlaps two labels and keeps them inside the plot", () => {
    const points = data.scores.map((s) => ({
      id: s.skillId,
      label: data.skills.get(s.skillId)!.name,
      x: s.jdSignal,
      y: s.newsSignal,
      priority: s.newsSignal + s.jdSignal,
    }));
    const boxes = placeLabels(points).flatMap((p, i) => {
      if (!p.label) return [];
      const w = textWidth(points[i].label);
      const x = p.label.anchor === "start" ? p.label.x : p.label.anchor === "end" ? p.label.x - w : p.label.x - w / 2;
      return [{ x, y: p.label.y - 11, w, h: 14 }];
    });
    expect(boxes.length).toBeGreaterThan(points.length / 2);
    for (const [i, a] of boxes.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(FRAME.pad.left);
      expect(a.x + a.w).toBeLessThanOrEqual(FRAME.width - FRAME.pad.right);
      for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    }
  });
});

describe("no em dashes", () => {
  it("appear nowhere in the source, scripts, tests, data, config, or docs", () => {
    const root = path.resolve(__dirname, "..");
    const files = ["src", "scripts", "tests", "data/generated", "data/live", "docs", "config"].flatMap((dir) =>
      fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && /\.(tsx?|json|md|css)$/.test(e.name))
        .map((e) => path.join(e.parentPath, e.name)),
    );
    files.push(path.join(root, "README.md"));
    const offenders = files.filter((f) => fs.readFileSync(f, "utf8").includes("\u2014"));
    expect(offenders).toEqual([]);
  });
});
