/** Small text helpers shared by loaders, schemas, and the UI. */

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
