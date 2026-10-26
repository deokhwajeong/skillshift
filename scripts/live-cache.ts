/**
 * npm run live:cache [-- --role tpm] [-- --sample] [-- --weak]
 *
 * Records one Live mode run of data/live/demo-article.md and saves it to
 * data/generated/<role>/live-cache.json. The Live page replays this recording
 * when the API is unavailable, so the demo never shows a dead end.
 *
 *   --weak     records data/live/weak-article.md (a vague opinion piece) to
 *              weak-cache.json instead: the "Try a weak input" demo, where
 *              nothing passes the editorial policy.
 *
 *   (default)  real run with ANTHROPIC_API_KEY, saved with mode "pipeline"
 *   --sample   no API: a scripted fake client answers instead, saved with
 *              mode "sample" so the page labels it SAMPLE. It still goes
 *              through the real runLive code, validation, policy, and scorer.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { loadRoleData, getScoringConfig } from "@/lib/data";
import { createLlm, type MessagesClient } from "@/lib/llm";
import { loadTaxonomy } from "@/pipeline/loaders";
import { runLive } from "@/pipeline/live";
import { LiveArticleInput, type LiveCacheFile, type LiveEvent } from "@/pipeline/schemas";

const argValue = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** Scripted answers for the SAMPLE demo article (see data/live/demo-article.md). */
const sampleClient = {
  messages: {
    create: async (params: { system: { text: string }[]; messages: { content: string }[] }) => {
      const system = params.system[0].text;
      const user = params.messages[0].content;
      let reply: unknown;
      if (system.includes("Filter Agent")) {
        reply = { relevance: 0.9, reason: "Describes a new release practice TPMs are asked to run.", duplicateOf: null };
      } else if (system.includes("Shift Extraction Agent")) {
        reply = {
          shifts: [
            { kind: "practice", summary: "Model changes now go through an online experiment before full rollout.", excerpt: "require an online experiment before any model change reaches all users", skillIds: ["experimentation-metrics"], candidateSkill: null, confidence: 0.92 },
            { kind: "practice", summary: "Offline evaluation stays the first launch gate for model updates.", excerpt: "offline evaluation is still the first gate", skillIds: ["llm-evaluation"], candidateSkill: null, confidence: 0.85 },
            { kind: "market", summary: "Inference prices for the largest models may keep rising.", excerpt: "inference prices could keep rising for the largest models", skillIds: ["cost-finops"], candidateSkill: null, confidence: 0.55 },
          ],
        };
      } else if (system.includes("Verification Agent")) {
        const id = (n: number) => user.match(new RegExp(`(live-[a-z0-9]+#s${n})`))![1];
        // The cost claim disagrees with an existing sample shift ("prices will fall"), if it was sent for comparison.
        const conflict = user.match(/(sample-news-07#s3)/)?.[1];
        reply = {
          results: [
            { shiftId: id(1), supported: true, evidenceLevel: "Strong", conflictsWith: [], note: "Stated directly in the article." },
            { shiftId: id(2), supported: true, evidenceLevel: "Moderate", conflictsWith: [], note: "Quoted from industry leaders." },
            { shiftId: id(3), supported: true, evidenceLevel: "Weak", conflictsWith: conflict ? [conflict] : [], note: "A single analyst's forecast; another source expects prices to fall." },
          ],
        };
      } else {
        throw new Error("The sample client only scripts Filter, Shift Extraction, and Verification.");
      }
      return { content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn", usage: { input_tokens: 1800, output_tokens: 260, cache_read_input_tokens: 900 } };
    },
  },
} as unknown as MessagesClient;

/**
 * Scripted answers for the weak article (data/live/weak-article.md). The first
 * extraction answer breaks the schema (a quote over 14 words), so the run shows
 * the real validation error and retry; the retried answer is valid but quotes
 * words the article never says, so the code check and the verifier both fail it.
 */
const weakSampleClient = {
  messages: {
    create: async (params: { system: { text: string }[]; messages: { content: string }[] }) => {
      const system = params.system[0].text;
      const user = params.messages[0].content;
      let reply: unknown;
      if (system.includes("Filter Agent")) {
        reply = { relevance: 0.55, reason: "Loosely about the future of work; it names no concrete change.", duplicateOf: null };
      } else if (system.includes("Shift Extraction Agent")) {
        const retry = params.messages.length > 1;
        reply = {
          shifts: [
            {
              kind: "practice",
              summary: "Teams will need new AI skills to stay competitive.",
              excerpt: retry
                ? "teams will need new AI skills to stay competitive"
                : "Many people feel that the next decade of work will look very different from the last one",
              skillIds: ["agentic-workflows"],
              candidateSkill: null,
              confidence: 0.4,
            },
          ],
        };
      } else if (system.includes("Verification Agent")) {
        const id = user.match(/(live-[a-z0-9]+#s1)/)![1];
        reply = {
          results: [
            { shiftId: id, supported: false, evidenceLevel: "Weak", conflictsWith: [], note: "The article never says this; it only speculates that change is coming." },
          ],
        };
      } else {
        throw new Error("The weak sample client only scripts Filter, Shift Extraction, and Verification.");
      }
      return { content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn", usage: { input_tokens: 1500, output_tokens: 180, cache_read_input_tokens: 900 } };
    },
  },
} as unknown as MessagesClient;

async function main() {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  const sample = process.argv.includes("--sample");
  const weak = process.argv.includes("--weak");
  const roleId = argValue("--role") ?? "tpm";
  if (!sample && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("No ANTHROPIC_API_KEY found. Add it, or run with --sample.");
    process.exit(1);
  }
  const data = loadRoleData(roleId);
  if (!data) throw new Error(`No generated data for role "${roleId}". Run npm run pipeline first.`);

  const file = path.join("data", "live", weak ? "weak-article.md" : "demo-article.md");
  const { data: fm, content } = matter(fs.readFileSync(file, "utf8"));
  const input = LiveArticleInput.parse({
    title: fm.title,
    source: fm.source,
    url: fm.url,
    publishedDate: fm.published_date instanceof Date ? fm.published_date.toISOString().slice(0, 10) : fm.published_date,
    sourceType: fm.source_type,
    body: content.trim(),
  });

  const events: LiveEvent[] = [];
  const result = await runLive(
    input,
    {
      role: data.role,
      roleSkills: [...data.skills.values()],
      allSkills: loadTaxonomy().skills,
      config: getScoringConfig(),
      articles: data.articles,
      shifts: data.shifts,
      jdMentions: data.jdMentions,
      analyzedJdCount: data.summary.analyzedJdIds.length,
    },
    createLlm(sample ? (weak ? weakSampleClient : sampleClient) : undefined),
    (e) => {
      events.push(e);
      if (e.type === "stage") console.log(`${e.status === "start" ? ">" : "+"} [${e.stage}] ${e.message}`);
    },
  );
  events.push({ type: "result", result });

  const cache: LiveCacheFile = { mode: sample ? "sample" : "pipeline", recordedAt: new Date().toISOString(), input, events };
  const out = path.join("data", "generated", roleId, weak ? "weak-cache.json" : "live-cache.json");
  fs.writeFileSync(out, JSON.stringify(cache, null, 2) + "\n");
  console.log(`\nWrote ${out} (${cache.mode}). ${result.changes.length} skill score(s) changed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
