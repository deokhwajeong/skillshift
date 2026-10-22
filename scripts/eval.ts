/**
 * npm run eval [-- --role tpm] [-- --template]
 *
 * Measures Shift Extraction and JD Analyzer against hand labels and writes
 * data/generated/<role>/eval.json (shown on the How it works screen).
 * No API calls: it grades the output the pipeline already produced.
 *
 *   Labels:     data/eval/<role>.json for a real pipeline run,
 *               data/eval/<role>.sample.json while the data is SAMPLE.
 *   --template  writes data/eval/<role>.template.json listing every article and
 *               JD of the current run with empty skill lists, ready to label.
 *               Rename it to <role>.json when done.
 */
import fs from "node:fs";
import path from "node:path";
import { evaluate, labelTemplate } from "@/eval/evaluate";
import { loadRoleData } from "@/lib/data";
import { EvalLabelsFile, type EvalReport } from "@/pipeline/schemas";

const argValue = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

function main() {
  const roleId = argValue("--role") ?? "tpm";
  const data = loadRoleData(roleId);
  if (!data) throw new Error(`No generated data for role "${roleId}". Run npm run pipeline first.`);
  const mode = data.summary.mode;

  if (process.argv.includes("--template")) {
    const template = labelTemplate(
      roleId,
      data.articles.map((a) => a.id),
      data.summary.analyzedJdIds,
    );
    // Titles as notes, so labeling does not need a second window.
    for (const a of template.articles) a.note = data.articles.find((x) => x.id === a.articleId)?.title;
    for (const j of template.jds) {
      const jd = data.jds.find((x) => x.id === j.jdId);
      j.note = jd && `${jd.company}: ${jd.title}`;
    }
    const out = path.join("data", "eval", `${roleId}.template.json`);
    fs.writeFileSync(out, JSON.stringify(template, null, 2) + "\n");
    console.log(`Wrote ${out}. Skill ids you can use:\n  ${[...data.skills.keys()].join("\n  ")}`);
    return;
  }

  const file = path.join("data", "eval", mode === "sample" ? `${roleId}.sample.json` : `${roleId}.json`);
  if (!fs.existsSync(file)) {
    console.error(`No labels at ${file}. Run npm run eval -- --template, fill it in, and save it as ${file}.`);
    process.exit(1);
  }
  const labels = EvalLabelsFile.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const report: EvalReport = evaluate({
    labels,
    mode,
    filter: data.filter,
    shifts: data.shifts,
    jdMentions: data.jdMentions,
    analyzedJdIds: data.summary.analyzedJdIds,
    evaluatedAt: new Date().toISOString(),
  });
  const out = path.join("data", "generated", roleId, "eval.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

  const sx = report.shiftExtraction;
  const jd = report.jdAnalyzer;
  console.log(`Labels: ${file}${mode === "sample" ? " (SAMPLE)" : ""}\n`);
  console.log(`Shift Extraction  ${sx.articles} articles   precision ${pct(sx.precision)}  recall ${pct(sx.recall)}  F1 ${pct(sx.f1)}`);
  if (sx.skippedDropped.length) console.log(`  skipped (dropped by the Filter): ${sx.skippedDropped.join(", ")}`);
  console.log(`JD Analyzer       ${jd.jds} postings    precision ${pct(jd.precision)}  recall ${pct(jd.recall)}  F1 ${pct(jd.f1)}  required/preferred right ${pct(jd.requirementAccuracy)}`);
  console.log("\nDisagreements (missed = labeled but not found, extra = found but not labeled):");
  for (const e of [...sx.errors, ...jd.errors]) {
    console.log(`  ${e.itemId}: ${e.missed.length ? `missed ${e.missed.join(", ")}` : ""}${e.missed.length && e.extra.length ? "; " : ""}${e.extra.length ? `extra ${e.extra.join(", ")}` : ""}`);
  }
  console.log(`\nWrote ${out}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
