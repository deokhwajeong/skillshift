/**
 * End-to-end orchestrator test on the real placeholder data, with a fake
 * Claude client. Proves the wiring, every agent's schema, and the editorial
 * routing without spending API credits.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingest } from "@/agents/ingest";
import { createLlm, type MessagesClient } from "@/lib/llm";
import { runPipeline } from "@/pipeline/orchestrator";

/** First n words of the body inside <article> or <job_description> tags. */
function firstWords(prompt: string, n: number): string {
  const body = prompt.split(/<(?:article|job_description)[^>]*>/)[1].split("\n\n").slice(1).join(" ");
  return body.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

const fake = {
  messages: {
    create: async (params: { system: { text: string }[]; messages: { content: string }[] }) => {
      const system = params.system[0].text;
      const user = params.messages[0].content;
      let reply: unknown;
      if (system.includes("Filter Agent")) {
        // Drop the Web3 article as off topic so the filter path is exercised both ways.
        reply = user.includes('<article id="ph-news-003"') ? { relevance: 0.3, reason: "Off topic.", duplicateOf: null } : { relevance: 0.9, reason: "Relevant.", duplicateOf: null };
      } else if (system.includes("Shift Extraction Agent")) {
        reply = {
          shifts: [
            { kind: "practice", summary: "A change.", excerpt: firstWords(user, 6), skillIds: ["llm-evaluation"], candidateSkill: null, confidence: 0.9 },
            { kind: "market", summary: "A guess.", excerpt: "words that are not in the article", skillIds: ["cost-finops"], candidateSkill: null, confidence: 0.5 },
          ],
        };
      } else if (system.includes("Verification Agent")) {
        const ids = [...user.matchAll(/^- (\S+#s\d+) \[/gm)].map((m) => m[1]).filter((id) => user.indexOf(id) < user.indexOf("Shifts from other"));
        reply = { results: ids.map((shiftId) => ({ shiftId, supported: true, evidenceLevel: "Strong", conflictsWith: [], note: "ok" })) };
      } else if (system.includes("JD Analyzer Agent")) {
        reply = { mentions: [{ skillId: "agile-program-execution", requirement: "required", excerpt: firstWords(user, 4) }] };
      } else {
        throw new Error("unexpected agent");
      }
      return { content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } };
    },
  },
} as unknown as MessagesClient;

describe("runPipeline (fake LLM, placeholder data)", () => {
  it("runs every stage and routes shifts correctly", async () => {
    const input = ingest("tpm", { root: path.resolve(__dirname, "..") });
    const events: string[] = [];
    const out = await runPipeline(input, createLlm(fake), { onProgress: (e) => events.push(`${e.stage}:${e.status}`) });

    expect(out.failures).toEqual([]);
    expect(out.filter.filter((d) => d.keep)).toHaveLength(2);
    // 2 kept articles x 2 shifts. The real excerpt publishes; the invented one is queued.
    expect(out.shifts).toHaveLength(4);
    expect(out.shifts.filter((s) => s.status === "published")).toHaveLength(2);
    expect(out.shifts.filter((s) => !s.excerptFound).every((s) => s.status === "queued")).toBe(true);
    expect(out.queue.every((q) => q.kind === "low-confidence")).toBe(true);
    expect(out.jdMentions).toHaveLength(3);
    expect(out.analyzedJdIds).toHaveLength(3);
    expect(out.stages.map((s) => [s.stage, s.inCount, s.outCount])).toEqual([
      ["ingest", 6, 6],
      ["filter", 3, 2],
      ["extract", 2, 4],
      ["verify", 4, 2],
      ["jd", 3, 3],
    ]);
    expect(events).toContain("verify:done");
    // 3 filter + 2 extract + 2 verify + 3 JD calls
    expect(out.runLog).toHaveLength(10);
  });
});
