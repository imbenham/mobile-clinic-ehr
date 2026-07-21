"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Light/dark toggle. Sets data-mode on <html> (CSS in globals.css keys off it),
 * orthogonal to the palette, and remembers the choice. The inline script in the
 * root layout applies it before first paint, so there's no flash.
 */

const STORAGE_KEY = "mc-mode";
const CHANGE_EVENT = "mc-mode-change";
const DEFAULT = "light";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ModeToggle() {
  const mode = useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-mode") || DEFAULT,
    () => DEFAULT,
  );

  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (pending === null) return;
    document.documentElement.setAttribute("data-mode", pending);
    try {
      localStorage.setItem(STORAGE_KEY, pending);
    } catch {
      // ignore storage failures — the mode still applies for this session.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [pending]);

  const dark = mode === "dark";

  return (
    <button
      type="button"
      onClick={() => setPending(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid min-h-11 min-w-11 place-items-center rounded-md text-muted transition hover:bg-background hover:text-foreground"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
