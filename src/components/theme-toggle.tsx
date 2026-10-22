"use client";

/** Flips data-theme on <html> and remembers the choice. Icons switch in CSS (globals.css). */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode: the toggle still works for this page view.
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-full border border-rule p-1.5 text-ink-2 hover:border-ink hover:text-ink"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="theme-icon-dark h-4 w-4 fill-current">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg aria-hidden viewBox="0 0 24 24" className="theme-icon-light h-4 w-4 fill-none stroke-current" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
