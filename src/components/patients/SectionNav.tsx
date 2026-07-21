"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sticky in-page section navigation for the long patient record.
 *
 * On a tablet a clinician shouldn't have to thumb-scroll a full record to reach
 * medications or vitals. These chips stick under the top of the pane, jump to
 * each section, and highlight whichever is in view.
 *
 * Highlighting follows scroll position: the current section is the last one
 * whose top has passed a line just below the sticky bar. Trailing sections that
 * are too near the end to ever reach that line can't be selected by scrolling
 * (there's no scroll left to distinguish them), so a click selects its chip
 * directly and briefly locks out the scroll listener while the jump settles —
 * which is how the last section gets highlighted.
 */

// How far below the sticky bar a section's top must pass to count as current.
const ACTIVE_OFFSET = 100;
// Ignore scroll-driven updates briefly after a click, while the jump settles.
const CLICK_LOCK_MS = 600;

export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const lockedRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeActive = useCallback(() => {
    let current = sections[0]?.id;
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el && el.getBoundingClientRect().top <= ACTIVE_OFFSET) current = section.id;
    }
    return current;
  }, [sections]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!lockedRef.current) setActive(computeActive());
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame = requestAnimationFrame(update); // set initial highlight
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [computeActive]);

  useEffect(() => () => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);

  const handleClick = (id: string) => {
    // The clicked chip wins immediately; let the anchor do the scrolling.
    setActive(id);
    lockedRef.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockedRef.current = false;
    }, CLICK_LOCK_MS);
  };

  return (
    <nav className="sticky top-0 z-10 overflow-x-auto border-b border-border bg-background/85 py-2 backdrop-blur">
      <ul className="flex gap-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={() => handleClick(s.id)}
              aria-current={active === s.id ? "location" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition ${
                active === s.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
