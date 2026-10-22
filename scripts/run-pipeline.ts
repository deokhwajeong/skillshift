/**
 * npm run pipeline [-- --role tpm]
 *
 * Runs the full agent pipeline offline and writes the results to
 * data/generated/<role>/*.json. Those files are committed, so the app (and the
 * demo) reads precomputed results and never waits on an API call.
 */
import fs from "node:fs";
import { ingest } from "@/agents/ingest";
import { createLlm } from "@/lib/llm";
import { articleCard, jdCard, runPipeline } from "@/pipeline/orchestrator";
import { writeGenerated } from "@/pipeline/output";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("No ANTHROPIC_API_KEY found. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }

  const roleId = argValue("--role") ?? "tpm";
  const input = ingest(roleId);
  if (input.role.status !== "full") {
    console.error(`Role "${roleId}" is a team expansion role with no dataset yet.`);
    process.exit(1);
  }

  const started = Date.now();
  const output = await runPipeline(input, createLlm(), {
    onProgress: (e) => console.log(`${e.status === "start" ? ">" : "+"} [${e.stage}] ${e.message}`),
  });

  const dir = writeGenerated(process.cwd(), { ...output, articles: input.articles.map(articleCard), jds: input.jds.map(jdCard) }, "pipeline");

  const tokens = output.runLog.reduce(
    (t, r) => ({ input: t.input + r.inputTokens, output: t.output + r.outputTokens, cache: t.cache + r.cacheReadTokens }),
    { input: 0, output: 0, cache: 0 },
  );
  console.log("\nStage                In -> Out");
  for (const s of output.stages) console.log(`${s.label.padEnd(20)} ${String(s.inCount).padStart(3)} -> ${String(s.outCount).padEnd(4)} ${s.note}`);
  console.log(`\n${output.runLog.length} LLM calls, ${output.runLog.filter((r) => r.retries).length} retried, ${output.failures.length} failed`);
  console.log(`Tokens: ${tokens.input} in (+${tokens.cache} from cache), ${tokens.output} out`);
  console.log(`Time: ${((Date.now() - started) / 1000).toFixed(1)}s. Wrote ${dir}/`);
  for (const f of output.failures) console.log(`  FAILED ${f.agent} ${f.itemId}: ${f.error}`);
  console.log("\nMatrix:");
  for (const s of [...output.scores].sort((a, b) => a.quadrant.localeCompare(b.quadrant))) {
    if (s.quadrant !== "Quiet") console.log(`  ${s.quadrant.padEnd(12)} ${s.skillId.padEnd(32)} news ${s.newsSignal.toFixed(2)}  jd ${s.jdSignal.toFixed(2)}  momentum ${s.momentum.toFixed(2)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
