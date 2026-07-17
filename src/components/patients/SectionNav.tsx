"use client";

import { useEffect, useState } from "react";

/**
 * Sticky in-page section navigation for the long patient record.
 *
 * On a tablet a clinician shouldn't have to thumb-scroll a full record to reach
 * medications or vitals. These chips stick under the top of the pane, jump to
 * each section, and highlight whichever is in view. The bar scrolls horizontally
 * if the chips overflow a narrow (portrait) pane.
 */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const onscreen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (onscreen[0]) setActive(onscreen[0].target.id);
      },
      // Trip once a section clears the sticky bar and before it leaves up top.
      { rootMargin: "-88px 0px -55% 0px" },
    );

    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="sticky top-0 z-10 overflow-x-auto border-b border-border bg-background/85 py-2 backdrop-blur">
      <ul className="flex gap-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
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
