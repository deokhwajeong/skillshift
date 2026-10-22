/**
 * Phase 5: browser re-scoring, Live mode (with a fake Claude client), the
 * Live API's passphrase guard, and the audio brief script.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/live/route";
import { briefScript, stripCitations } from "@/lib/brief-script";
import { getScoringConfig, loadLiveCache, loadRoleData } from "@/lib/data";
import { createLlm, type MessagesClient } from "@/lib/llm";
import { diffScores, rescore, type RescoreInput } from "@/lib/rescore";
import { decisionFor } from "@/pipeline/editorial";
import { loadEditorDecisions, loadTaxonomy } from "@/pipeline/loaders";
import { liveArticleId, runLive, type LiveContext } from "@/pipeline/live";
import type { LiveArticleInput, LiveEvent } from "@/pipeline/schemas";

const data = loadRoleData("tpm")!;
const config = getScoringConfig();
const input: RescoreInput = {
  role: "tpm",
  skills: [...data.skills.values()],
  shifts: data.shifts,
  queue: data.queue,
  articles: data.articles,
  jdMentions: data.jdMentions,
  analyzedJdCount: data.summary.analyzedJdIds.length,
  config,
};
const at = "2026-10-22T00:00:00Z";

describe("rescore (Editor Queue in the browser)", () => {
  it("reproduces the published scores exactly when there are no decisions", () => {
    expect(rescore(input, []).scores).toEqual(data.scores);
  });

  const approveAll = (shiftId: string, decision: "approve" | "reject" = "approve") => {
    const shift = data.shifts.find((s) => s.id === shiftId)!;
    return data.queue.filter((q) => q.shiftId === shiftId).map((q) => decisionFor(q, shift, decision, at));
  };

  it("moves a skill when an editor approves the item holding its shift", () => {
    const approved = rescore(input, approveAll("sample-news-06#s3"));
    expect(approved.approvedShiftIds).toEqual(["sample-news-06#s3"]);
    const changes = diffScores(data.scores, approved.scores);
    expect(changes.map((c) => c.skillId)).toEqual(["experimentation-metrics"]);
    expect(changes[0].after.newsSignal).toBeGreaterThan(changes[0].before.newsSignal);
    expect(rescore(input, approveAll("sample-news-06#s3", "reject")).scores).toEqual(data.scores);
  });

  it("does not double count: an article already counted for a skill adds nothing", () => {
    // sample-news-07 already counts for cost-finops through its stronger shift #s1.
    const approved = rescore(input, approveAll("sample-news-07#s3"));
    expect(approved.approvedShiftIds).toEqual(["sample-news-07#s3"]);
    expect(diffScores(data.scores, approved.scores)).toEqual([]);
  });

  it("keeps a browser decision after a re-run renumbers the shift (matched by article and excerpt)", () => {
    const [stale] = approveAll("sample-news-06#s3").map((d) => ({ ...d, itemId: "sample-news-06#s9:low-confidence" }));
    const out = rescore(input, [stale]);
    expect(out.approvedShiftIds).toEqual(["sample-news-06#s3"]);
    // The queue the Editor Queue screen renders shows the same decision the score used.
    expect(out.queue.find((q) => q.shiftId === "sample-news-06#s3")?.decision).toBe("approve");
  });

  it("lets a local Undo (pending) re-open a decision that came from decisions.json", () => {
    const fromFile: RescoreInput = {
      ...input,
      queue: input.queue.map((q) => (q.shiftId === "sample-news-06#s3" ? { ...q, decision: "approve" as const } : q)),
    };
    expect(rescore(fromFile, []).approvedShiftIds).toEqual(["sample-news-06#s3"]);
    const undo = approveAll("sample-news-06#s3").map((d) => ({ ...d, decision: "pending" as const }));
    const out = rescore(fromFile, undo);
    expect(out.approvedShiftIds).toEqual([]);
    expect(out.queue.find((q) => q.shiftId === "sample-news-06#s3")?.decision).toBeUndefined();
    expect(out.scores).toEqual(data.scores);
  });

  it("treats a missing decisions file as no decisions", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "skillshift-"));
    expect(loadEditorDecisions({ root: empty })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Live mode
// ---------------------------------------------------------------------------

const article: LiveArticleInput = {
  title: "Teams add rollout experiments for model changes",
  source: "Test Weekly",
  url: "https://example.com/live-test",
  publishedDate: "2026-10-20",
  sourceType: "primary",
  body: "Product teams now require an online experiment before any model change reaches all users. ".repeat(6),
};

function fakeClient(keep: boolean): MessagesClient {
  return {
    messages: {
      create: async (params: { system: { text: string }[]; messages: { content: string }[] }) => {
        const system = params.system[0].text;
        const user = params.messages[0].content;
        let reply: unknown;
        if (system.includes("Filter Agent")) reply = { relevance: keep ? 0.9 : 0.2, reason: keep ? "Relevant." : "Off topic.", duplicateOf: null };
        else if (system.includes("Shift Extraction Agent"))
          reply = { shifts: [{ kind: "practice", summary: "Experiments gate model changes.", excerpt: "require an online experiment before any model change", skillIds: ["experimentation-metrics"], candidateSkill: null, confidence: 0.9 }] };
        else if (system.includes("Verification Agent")) {
          const id = user.match(/(live-[a-z0-9]+#s1)/)![1];
          reply = { results: [{ shiftId: id, supported: true, evidenceLevel: "Strong", conflictsWith: [], note: "Stated." }] };
        } else throw new Error("unexpected agent");
        return { content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } };
      },
    },
  } as unknown as MessagesClient;
}

const ctx: LiveContext = {
  role: data.role,
  roleSkills: [...data.skills.values()],
  allSkills: loadTaxonomy().skills,
  config,
  articles: data.articles,
  shifts: data.shifts,
  jdMentions: data.jdMentions,
  analyzedJdCount: data.summary.analyzedJdIds.length,
};

describe("runLive", () => {
  it("streams each stage and re-scores with the new published shift", async () => {
    const events: LiveEvent[] = [];
    const result = await runLive(article, ctx, createLlm(fakeClient(true)), (e) => events.push(e));
    expect(events.filter((e) => e.type === "stage" && e.status === "done").map((e) => e.type === "stage" && e.stage)).toEqual([
      "ingest",
      "filter",
      "extract",
      "verify",
      "score",
    ]);
    expect(result.article.id).toBe(liveArticleId(article.url));
    expect(result.shifts[0].status).toBe("published");
    expect(result.shifts[0].excerptFound).toBe(true);
    expect(result.asOfDate).toBe("2026-10-20");
    expect(result.changes.map((c) => c.skillId)).toEqual(["experimentation-metrics"]);
    expect(result.changes[0].before.newsSignal).toBe(0);
    expect(result.changes[0].after.newsSignal).toBeGreaterThan(0);
    expect(result.runLog).toHaveLength(3);
  });

  it("stops after the Filter when the article is dropped", async () => {
    const result = await runLive(article, ctx, createLlm(fakeClient(false)));
    expect(result.filter.keep).toBe(false);
    expect(result.shifts).toEqual([]);
    expect(result.changes).toEqual([]);
    expect(result.runLog).toHaveLength(1);
  });

  it("has a valid cached run to fall back on, ending in a result", () => {
    const cache = loadLiveCache("tpm")!;
    expect(cache).not.toBeNull();
    expect(cache.events.at(-1)?.type).toBe("result");
  });
});

describe("POST /api/live", () => {
  it("refuses without a passphrase outside local development", async () => {
    const response = await POST(new Request("http://x/api/live", { method: "POST", body: JSON.stringify({ role: "tpm", article }) }));
    expect(response.status).toBe(401);
    const line = JSON.parse((await response.text()).trim());
    expect(line.type).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// Audio brief
// ---------------------------------------------------------------------------

describe("briefScript", () => {
  it("drops citation markers and tidies the punctuation around them", () => {
    expect(stripCitations("A rule [news-01], and more [jd-02][jd-03].")).toBe("A rule, and more.");
  });

  it("reads every brief item with intro and sign-off, and no source ids", () => {
    const lines = briefScript(data.brief!, "Technical Program Manager", "Monday, October 19, 2026");
    expect(lines[0].item).toBeNull();
    expect(lines.at(-1)!.item).toBeNull();
    expect(new Set(lines.flatMap((l) => (l.item === null ? [] : [l.item])))).toEqual(new Set([0, 1, 2]));
    expect(lines.some((l) => /\[[^\]]+\]/.test(l.text))).toBe(false);
  });
});
