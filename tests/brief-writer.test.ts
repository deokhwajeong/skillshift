import { describe, expect, it } from "vitest";
import scoringJson from "../config/scoring.json";
import { citedIds, runBriefWriter, selectBriefSkills } from "@/agents/brief-writer";
import { createLlm, type MessagesClient } from "@/lib/llm";
import { ScoringConfig, type SkillScore } from "@/pipeline/schemas";

const config = ScoringConfig.parse(scoringJson);

const score = (skillId: string, quadrant: SkillScore["quadrant"], newsSignal: number, newsEvidence = ["n1#s1"]): SkillScore => ({
  skillId,
  role: "tpm",
  newsSignal,
  jdSignal: 0.5,
  momentum: 0,
  quadrant,
  stats: { articles: 1, recentArticles: 1, earlierArticles: 0, newsWeight: 1, required: 1, preferred: 0, jdCount: 2 },
  newsEvidence,
  jdEvidence: [{ jdId: "jd1", skillId, requirement: "required", excerpt: "required text" }],
});

describe("selectBriefSkills", () => {
  it("prefers news-driven quadrants, then stronger news, max 3", () => {
    const picked = selectBriefSkills([
      score("est", "Established", 0.1),
      score("emerging-weak", "Emerging", 0.5),
      score("rising", "Rising", 0.45),
      score("emerging-strong", "Emerging", 0.9),
      score("fading", "Fading", 0.1),
      score("quiet", "Quiet", 0.3),
    ]);
    expect(picked.map((s) => s.skillId)).toEqual(["rising", "emerging-strong", "emerging-weak"]);
  });

  it("skips skills without news evidence", () => {
    expect(selectBriefSkills([score("est", "Established", 0, [])])).toEqual([]);
  });
});

describe("citedIds", () => {
  it("finds bracketed source ids", () => {
    expect(citedIds("Teams changed [news-001] and hiring grew [jd-tpm-002][news-003].")).toEqual(["news-001", "jd-tpm-002", "news-003"]);
  });
});

describe("runBriefWriter", () => {
  const input = {
    role: { id: "tpm", label: "TPM", name: "Technical Program Manager", status: "full" as const, description: "" },
    asOfDate: "2026-10-14",
    scores: [score("evals", "Rising", 0.8)],
    shifts: [
      {
        id: "n1#s1",
        articleId: "n1",
        kind: "practice" as const,
        summary: "Teams add eval gates.",
        excerpt: "eval gates",
        skillIds: ["evals"],
        candidateSkill: null,
        confidence: 0.9,
        excerptFound: true,
        verification: { shiftId: "n1#s1", supported: true, evidenceLevel: "Strong" as const, conflictsWith: [], note: "" },
        status: "published" as const,
      },
    ],
    articles: [{ id: "n1", title: "T", source: "S", url: "https://example.com/n1", publishedDate: "2026-10-14", sourceType: "trade" as const, placeholder: false }],
    jds: [{ id: "jd1", company: "C", title: "TPM", url: "https://example.com/jd1", capturedDate: "2026-10-14", level: "L5", placeholder: false }],
    skills: [{ id: "evals", name: "LLM evaluation", description: "d", aliases: [], roles: ["tpm"] }],
    config,
  };

  const item = (whatChanged: string, extra = "") => ({
    items: [
      {
        skillIds: ["evals"],
        headline: "Evals gate launches" + extra,
        whatChanged,
        whyItMatters: "Postings now require it [jd1].",
        whatToDo: { learn: "Build an eval set.", resumeAngle: "Show a gate you ran.", interviewQuestion: "How do you know a model is ready?" },
      },
    ],
  });

  function fake(replies: unknown[]) {
    const seen: string[] = [];
    let i = 0;
    const client = {
      messages: {
        create: async (p: { messages: unknown[] }) => {
          seen.push(JSON.stringify(p.messages));
          return { content: [{ type: "text", text: JSON.stringify(replies[i++]) }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
        },
      },
    } as unknown as MessagesClient;
    return { client, seen };
  }

  it("collects citations from the text", async () => {
    const { client } = fake([item("Teams add eval gates [n1].")]);
    const brief = await runBriefWriter(createLlm(client), input);
    expect(brief.items[0].citations).toEqual(["n1", "jd1"]);
    expect(brief.date).toBe("2026-10-14");
  });

  it("sends an invented citation back for one retry", async () => {
    const { client, seen } = fake([item("Teams add eval gates [made-up-source]."), item("Teams add eval gates [n1].")]);
    const brief = await runBriefWriter(createLlm(client), input);
    expect(seen[1]).toContain('cites \\"made-up-source\\", which is not in the evidence');
    expect(brief.items[0].citations).toContain("n1");
  });

  it("rejects missing citations and em dashes", async () => {
    const { client } = fake([item("Teams add eval gates."), item("Teams add eval gates [n1].", " \u2014 now")]);
    await expect(runBriefWriter(createLlm(client), input)).rejects.toThrow(/failed validation/);
  });
});
