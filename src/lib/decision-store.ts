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
import { EditorDecision } from "@/pipeline/schemas";

const key = (role: string) => `skillshift:decisions:${role}`;
const EVENT = "skillshift:decisions";
const EMPTY: EditorDecision[] = [];

// Cache the parsed list per raw string, so React sees the same array until it really changes.
const cache = new Map<string, { raw: string | null; value: EditorDecision[] }>();

function read(role: string): EditorDecision[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(role));
  } catch {
    return EMPTY; // storage blocked (private mode): behave as "no decisions"
  }
  const hit = cache.get(role);
  if (hit && hit.raw === raw) return hit.value;
  let value = EMPTY;
  if (raw) {
    const parsed = z.array(EditorDecision).safeParse(JSON.parse(raw));
    value = parsed.success ? parsed.data : EMPTY;
  }
  cache.set(role, { raw, value });
  return value;
}

function write(role: string, decisions: EditorDecision[]) {
  try {
    if (decisions.length) localStorage.setItem(key(role), JSON.stringify(decisions));
    else localStorage.removeItem(key(role));
  } catch {
    // Storage blocked: the decision is lost on reload, which the page already allows for.
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
export function useDecisions(role: string): EditorDecision[] {
  return useSyncExternalStore(subscribe, () => read(role), () => EMPTY);
}

/** Record (or replace) the decision for one queue item. */
export function setDecision(role: string, decision: EditorDecision) {
  write(role, [...read(role).filter((d) => d.itemId !== decision.itemId), decision]);
}

export function clearDecision(role: string, itemId: string) {
  write(role, read(role).filter((d) => d.itemId !== itemId));
}

export function clearAllDecisions(role: string) {
  write(role, []);
}
