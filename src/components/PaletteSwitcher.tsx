"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Colour-theme switcher. Sets `data-palette` on <html> (the CSS in globals.css
 * keys off it) and remembers the choice in localStorage. A tiny inline script in
 * the root layout applies the stored palette before first paint, so there's no
 * flash; this control just reads/writes it.
 */

const STORAGE_KEY = "mc-palette";
const CHANGE_EVENT = "mc-palette-change";
const DEFAULT = "lavender";

const PALETTES = [
  { key: "lavender", label: "Lavender & Onyx", swatch: "#6d54c7" },
  { key: "teal", label: "Teal & Slate", swatch: "#0f766e" },
  { key: "emerald", label: "Emerald & Graphite", swatch: "#047857" },
  { key: "cardinal", label: "Cardinal & Cream", swatch: "#a4133c" },
];

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function PaletteSwitcher() {
  const active = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.palette || DEFAULT,
    () => DEFAULT,
  );

  // Applying the choice mutates <html> and localStorage, which must happen in an
  // effect rather than the click handler. The click just records the intent.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (pending === null) return;
    document.documentElement.dataset.palette = pending;
    try {
      localStorage.setItem(STORAGE_KEY, pending);
    } catch {
      // ignore storage failures — the theme still applies for this session.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [pending]);

  return (
    <div className="flex items-center" role="group" aria-label="Colour theme">
      {PALETTES.map((palette) => (
        <button
          key={palette.key}
          type="button"
          onClick={() => setPending(palette.key)}
          title={palette.label}
          aria-label={palette.label}
          aria-pressed={active === palette.key}
          className="grid min-h-11 place-items-center px-1"
        >
          <span
            className={`block h-5 w-5 rounded-full transition ${
              active === palette.key
                ? "ring-2 ring-foreground/50 ring-offset-2 ring-offset-surface"
                : "opacity-45 hover:opacity-100"
            }`}
            style={{ backgroundColor: palette.swatch }}
          />
        </button>
      ))}
    </div>
  );
}
