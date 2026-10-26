/**
 * npm run zip
 *
 * Packages the project for submission: dist/skillshift-submission.zip, with the
 * project files at the zip root. Uses `git archive`, so it contains exactly the
 * committed files: node_modules, .next, .vercel, .git, and .env.local are never
 * in git, so they are never in the zip. one-pager.pdf at the repo root is added
 * even if it is not committed yet.
 * It then double-checks the file list and contents and refuses if anything
 * secret-looking slipped in. .env.example (no values) is kept on purpose: it
 * documents setup.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

const OUT = path.join("dist", "skillshift-submission.zip");
const ONE_PAGER = "one-pager.pdf";

/** Paths that must never be submitted. */
function forbidden(file: string): boolean {
  const name = path.posix.basename(file);
  const parts = file.split("/");
  return (
    (name.startsWith(".env") && name !== ".env.example") ||
    parts.includes("node_modules") ||
    parts.includes(".git") ||
    file.startsWith(".next/") ||
    file.startsWith(".vercel/") ||
    /\.(pem|key)$/.test(name)
  );
}

/** Committed text that looks like a real key (not a placeholder). */
function leakedSecrets(): string[] {
  try {
    return git("grep", "-I", "-n", "-E", "sk-ant-[A-Za-z0-9_-]{20,}", "HEAD").split("\n").filter(Boolean);
  } catch {
    return []; // git grep exits 1 when nothing matches
  }
}

function main() {
  const files = git("ls-tree", "-r", "--name-only", "HEAD").split("\n").filter(Boolean);
  const bad = files.filter(forbidden);
  if (bad.length) {
    console.error(`Refusing to zip. These committed files look secret or generated:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const leaks = leakedSecrets();
  if (leaks.length) {
    console.error(`Refusing to zip. These lines look like API keys:\n  ${leaks.join("\n  ")}`);
    process.exit(1);
  }
  const dirty = git("status", "--porcelain").trim();
  if (dirty) console.warn("Note: you have uncommitted changes. The zip contains the last commit only.\n");

  const extra: string[] = [];
  if (!files.includes(ONE_PAGER)) {
    if (fs.existsSync(ONE_PAGER)) extra.push(`--add-file=${ONE_PAGER}`);
    else console.warn(`Note: ${ONE_PAGER} is not in the repo root yet, so it is not in the zip.\n`);
  }

  fs.mkdirSync("dist", { recursive: true });
  fs.rmSync(OUT, { force: true });
  git("archive", "--format=zip", ...extra, "-o", OUT, "HEAD");
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  const count = files.length + extra.length;
  console.log(`Wrote ${OUT} (${count} files, ${kb} KB) from commit ${git("rev-parse", "--short", "HEAD").trim()}.`);
}

main();
