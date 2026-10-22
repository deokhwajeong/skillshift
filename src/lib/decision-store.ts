"use client";

/**
 * decision-store.ts: Editor Queue decisions made in this browser.
 *
 * Stored in localStorage per role (no database, per the project decision).
 * Every component that reads decisions subscribes here, so approving an item
 * on the Editor Queue updates the matrix on Today without a reload.
 * "Export decisions" turns them into data/editorial/decisions.json for the pipeline.
 */
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { decisionKey, type DecisionInput } from "@/pipeline/editorial";
import { EditorDecision } from "@/pipeline/schemas";

/** Stored decisions may also be "pending": an Undo of a decision that came from decisions.json. */
const StoredDecision = EditorDecision.extend({ decision: z.enum(["approve", "reject", "pending"]) });

const key = (role: string) => `skillshift:decisions:${role}`;
const EVENT = "skillshift:decisions";
const EMPTY: DecisionInput[] = [];

// Cache the parsed list per raw string, so React sees the same array until it really changes.
const cache = new Map<string, { raw: string | null; value: DecisionInput[] }>();
// When localStorage is blocked or full, decisions live here for this page view instead of being lost.
const memory = new Map<string, string | null>();

function parse(raw: string | null): DecisionInput[] {
  if (!raw) return EMPTY;
  try {
    const parsed = z.array(StoredDecision).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY; // corrupted storage: start over rather than break the page
  }
}

function read(role: string): DecisionInput[] {
  let raw: string | null = null;
  if (memory.has(role)) raw = memory.get(role) ?? null;
  else {
    try {
      raw = localStorage.getItem(key(role));
    } catch {
      raw = null; // storage blocked: no saved decisions
    }
  }
  const hit = cache.get(role);
  if (hit && hit.raw === raw) return hit.value;
  const value = parse(raw);
  cache.set(role, { raw, value });
  return value;
}

function write(role: string, decisions: DecisionInput[]) {
  const raw = decisions.length ? JSON.stringify(decisions) : null;
  try {
    if (raw) localStorage.setItem(key(role), raw);
    else localStorage.removeItem(key(role));
    memory.delete(role);
  } catch {
    memory.set(role, raw); // kept until the page reloads, so Approve, Reject, and Export still work
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed them
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** This browser's decisions for a role. Empty during server rendering. */
export function useDecisions(role: string): DecisionInput[] {
  return useSyncExternalStore(subscribe, () => read(role), () => EMPTY);
}

/** Record (or replace) the decision for one queue item. Items are matched by decisionKey, not id. */
export function setDecision(role: string, decision: DecisionInput) {
  const key = decisionKey(decision);
  write(role, [...read(role).filter((d) => decisionKey(d) !== key), decision]);
}

/** Forget this browser's decision for one item (it falls back to decisions.json, if that has one). */
export function clearDecision(role: string, item: Parameters<typeof decisionKey>[0]) {
  const key = decisionKey(item);
  write(role, read(role).filter((d) => decisionKey(d) !== key));
}

export function clearAllDecisions(role: string) {
  write(role, []);
}
