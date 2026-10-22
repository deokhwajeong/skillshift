/**
 * output.ts: write a pipeline result to data/generated/<role>/ as the JSON
 * files the app reads. Used by `npm run pipeline` and `npm run sample`, so
 * real and sample data always have exactly the same shape.
 */
import fs from "node:fs";
import path from "node:path";
import type { PipelineOutput } from "./orchestrator";
import type { ArticleCard, JDCard } from "./schemas";

/** "pipeline" = produced by real agents. "sample" = hand-made data for UI work. */
export type DataMode = "pipeline" | "sample";

export interface GeneratedData extends PipelineOutput {
  articles: ArticleCard[];
  jds: JDCard[];
}

export function writeGenerated(root: string, data: GeneratedData, mode: DataMode): string {
  const dir = path.join(root, "data", "generated", data.role);
  fs.mkdirSync(dir, { recursive: true });
  const write = (name: string, value: unknown) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n");

  write("articles.json", data.articles);
  write("jds.json", data.jds);
  write("filter.json", data.filter);
  write("shifts.json", data.shifts);
  write("editor-queue.json", data.queue);
  write("jd-mentions.json", data.jdMentions);
  write("scores.json", { asOfDate: data.asOfDate, scores: data.scores });
  write("brief.json", data.brief);
  write("run-log.json", data.runLog);
  write("pipeline-summary.json", {
    mode,
    role: data.role,
    generatedAt: data.generatedAt,
    asOfDate: data.asOfDate,
    stages: data.stages,
    analyzedJdIds: data.analyzedJdIds,
    failures: data.failures,
  });
  return dir;
}
