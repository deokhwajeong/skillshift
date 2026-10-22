/**
 * npm run check:data
 *
 * Loads every config file and raw data file, validates them, and prints a
 * summary. Run it after adding articles or JDs, before running the pipeline.
 */
import {
  DataValidationError,
  loadArticles,
  loadEditorDecisions,
  loadJobDescriptions,
  loadRoles,
  loadScoringConfig,
  loadTaxonomy,
} from "@/pipeline/loaders";

function main() {
  const problems: string[] = [];
  const attempt = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof DataValidationError) problems.push(e.message);
      else throw e;
    }
  };

  const roles = attempt(loadRoles) ?? [];
  const taxonomy = attempt(() => loadTaxonomy(undefined, roles));
  attempt(loadScoringConfig);
  const articles = attempt(loadArticles) ?? [];
  const decisions = attempt(loadEditorDecisions) ?? [];

  console.log(`Roles:     ${roles.map((r) => `${r.id} (${r.status})`).join(", ")}`);
  console.log(`Skills:    ${taxonomy?.skills.length ?? "invalid"}`);
  const placeholders = articles.filter((a) => a.placeholder).length;
  console.log(`Articles:  ${articles.length} (${placeholders} placeholder)`);
  if (articles.length) {
    console.log(`           newest ${articles[0].publishedDate}, oldest ${articles.at(-1)!.publishedDate}`);
  }

  console.log(`Decisions: ${decisions.length} editor decision(s) in data/editorial/decisions.json`);

  for (const role of roles) {
    const jds = attempt(() => loadJobDescriptions(role.id)) ?? [];
    const skillsForRole = taxonomy?.skills.filter((s) => s.roles.includes(role.id)).length ?? 0;
    console.log(`JDs ${role.id.padEnd(5)}  ${jds.length} (${jds.filter((j) => j.placeholder).length} placeholder), ${skillsForRole} skills in taxonomy`);
  }

  if (problems.length) {
    console.error(`\n${problems.join("\n\n")}`);
    process.exit(1);
  }
  console.log("\nAll data valid.");
}

main();
