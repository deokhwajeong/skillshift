/** Small text helpers shared by loaders, schemas, and the UI. */

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Lowercase, unify curly quotes and dashes, collapse whitespace. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does `excerpt` appear word for word in `source`? Ignores case, whitespace,
 * quote style, and trailing punctuation. This is how we stop an LLM from
 * inventing a quote: the excerpt must literally be in the source text.
 */
export function containsExcerpt(source: string, excerpt: string): boolean {
  const needle = normalizeForMatch(excerpt).replace(/^[\s"'.,;:]+|[\s"'.,;:]+$/g, "");
  return needle.length > 0 && normalizeForMatch(source).includes(needle);
}
