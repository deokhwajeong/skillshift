/**
 * Helpers for building the JSON schemas we send to Claude.
 *
 * When the list of valid ids is known (taxonomy skills, article ids), we put
 * it in the schema as an enum. Structured outputs then make it impossible for
 * the model to return an id that does not exist.
 */
import { z } from "zod";

/** An enum of the given ids, or any string if the list is empty (code filters it later). */
export function idEnum(ids: string[]) {
  return ids.length ? z.enum(ids as [string, ...string[]]) : z.string();
}
