"use client";

/**
 * "Listen": reads Today's Brief aloud with the browser's own voice (Web Speech
 * API, free, no server call). Each line is its own utterance, so we always know
 * which brief item is being read and can highlight its card.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ScriptLine } from "@/lib/brief-script";

type State = "idle" | "speaking" | "paused";

const noop = () => () => {};

/** Mark the card being read (BriefCard renders id="brief-item-<n>"). */
function highlight(item: number | null) {
  document.querySelectorAll("[data-reading]").forEach((el) => el.removeAttribute("data-reading"));
  if (item !== null) document.getElementById(`brief-item-${item}`)?.setAttribute("data-reading", "true");
}

export function ListenButton({ lines }: { lines: ScriptLine[] }) {
  const supported = useSyncExternalStore(noop, () => "speechSynthesis" in window, () => true);
  const [state, setState] = useState<State>("idle");
  const [line, setLine] = useState(0);
  const session = useRef(0);

  // Stop talking when the reader leaves the page.
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      highlight(null);
    },
    [],
  );

  const stop = () => {
    session.current++;
    speechSynthesis.cancel();
    highlight(null);
    setState("idle");
  };

  const play = () => {
    speechSynthesis.cancel();
    const id = ++session.current;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("en") && v.localService) ?? null;
    lines.forEach((l, i) => {
      const u = new SpeechSynthesisUtterance(l.text);
      u.lang = "en-US";
      u.rate = 1;
      if (voice) u.voice = voice;
      u.onstart = () => {
        if (session.current !== id) return;
        setLine(i);
        highlight(l.item);
      };
      if (i === lines.length - 1) {
        u.onend = () => {
          if (session.current !== id) return;
          highlight(null);
          setState("idle");
        };
      }
      speechSynthesis.speak(u);
    });
    setState("speaking");
  };

  const toggle = () => {
    if (state === "idle") play();
    else if (state === "speaking") {
      speechSynthesis.pause();
      setState("paused");
    } else {
      speechSynthesis.resume();
      setState("speaking");
    }
  };

  if (!supported) return <p className="text-xs text-ink-3">Your browser cannot read aloud (no Web Speech API).</p>;

  const current = lines[line];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={state === "speaking" ? "Pause" : state === "paused" ? "Resume" : "Listen to Today's Brief"}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper hover:opacity-85"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
          {state === "speaking" ? <path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z" /> : <path d="M3 1.5v13L14 8z" />}
        </svg>
        {state === "speaking" ? "Pause" : state === "paused" ? "Resume" : "Listen"}
      </button>
      {state !== "idle" && (
        <>
          <button type="button" onClick={stop} className="text-sm text-ink-2 underline hover:text-ink">
            Stop
          </button>
          {/* The "anchor": a small voice meter that moves while the brief is read. */}
          <span aria-hidden className={`flex h-4 items-end gap-0.5 ${state === "speaking" ? "voice-meter" : ""}`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="w-1 rounded-sm bg-accent" style={{ height: "30%", animationDelay: `${i * 0.12}s` }} />
            ))}
          </span>
          <span className="max-w-xs truncate text-xs text-ink-3" aria-live="polite">
            {current?.item !== null && current ? `Reading item ${current.item + 1}` : "Reading"}
          </span>
        </>
      )}
    </div>
  );
}
