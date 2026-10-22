/**
 * npm run zip
 *
 * Packages the source for submission: dist/skillshift-source-<date>.zip.
 * Uses `git archive`, so it contains exactly the committed files: node_modules,
 * .next, and .env.local are never in git, so they are never in the zip.
 * It then double-checks the file list and refuses if anything secret-looking
 * slipped in. .env.example (no values) is kept on purpose: it documents setup.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

/** Paths that must never be submitted. */
function forbidden(file: string): boolean {
  const name = path.posix.basename(file);
  return (
    (name.startsWith(".env") && name !== ".env.example") ||
    file.split("/").includes("node_modules") ||
    file.startsWith(".next/") ||
    /\.(pem|key)$/.test(name)
  );
}

function main() {
  const files = git("ls-tree", "-r", "--name-only", "HEAD").split("\n").filter(Boolean);
  const bad = files.filter(forbidden);
  if (bad.length) {
    console.error(`Refusing to zip. These committed files look secret or generated:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const dirty = git("status", "--porcelain").trim();
  if (dirty) console.warn("Note: you have uncommitted changes. The zip contains the last commit only.\n");

  fs.mkdirSync("dist", { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const out = path.join("dist", `skillshift-source-${date}.zip`);
  git("archive", "--format=zip", `--prefix=skillshift/`, "-o", out, "HEAD");
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`Wrote ${out} (${files.length} files, ${kb} KB) from commit ${git("rev-parse", "--short", "HEAD").trim()}.`);
}

main();
