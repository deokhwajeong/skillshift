import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_LINKS, LLM_WRAPPER_LINKS, codeUrl } from "@/lib/code-links";

const root = path.resolve(__dirname, "..");

describe("View code links", () => {
  const all = [...LLM_WRAPPER_LINKS, ...Object.values(CODE_LINKS).flat()];

  it.each(all.map((l) => [`${l.path}#L${l.lines[0]}`, l] as const))("%s still points at its code", (_, link) => {
    const lines = fs.readFileSync(path.join(root, link.path), "utf8").split("\n");
    expect(link.lines[0]).toBeLessThanOrEqual(link.lines[1]);
    expect(link.lines[1]).toBeLessThanOrEqual(lines.length);
    expect(lines[link.lines[0] - 1]).toContain(link.starts);
  });

  it("builds GitHub line-range URLs", () => {
    expect(codeUrl(CODE_LINKS.score[0])).toBe("https://github.com/deokhwajeong/skillshift/blob/main/src/scoring/signal-scorer.ts#L99-L161");
  });
});
