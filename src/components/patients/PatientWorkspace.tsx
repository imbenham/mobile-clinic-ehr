"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import type { PatientView } from "@/lib/fhir/patient-types";

import { PatientRail } from "./PatientRail";

/**
 * Landscape split-view shell with a collapsible patient rail.
 *
 * "Finding a patient" and "reading a chart" are distinct activities, so a
 * patient route defaults to focus mode: the rail folded to a slim strip, giving
 * the record the full pane. Expanding is a *transient* reveal — a way to see the
 * roster and switch — not a saved preference: selecting a patient folds it back,
 * so focus-by-default can never be permanently switched off just by browsing.
 *
 * Because "collapsed on a patient route" is derived from the URL, the server
 * renders the right state on first paint (no hydration flash). The index is
 * always browse mode with the roster open — collapsing the thing you're
 * searching makes no sense. Portrait doesn't render this rail at all (the index
 * route shows the roster full-width), so this is landscape-only by construction.
 */
export function PatientWorkspace({
  patients,
  children,
}: {
  patients: PatientView[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasSelection = pathname !== "/patients";

  // Transient reveal state — reset whenever a patient is chosen (see the rail's
  // onNavigate) so every selection lands in focus mode.
  const [expanded, setExpanded] = useState(false);

  const showCollapsed = hasSelection && !expanded;

  return (
    <div className="lg:flex lg:gap-6">
      <aside
        className={`hidden lg:block lg:shrink-0 lg:transition-[width] lg:duration-200 ${
          showCollapsed ? "lg:w-2" : "lg:w-72"
        }`}
      >
        {showCollapsed ? (
          // Folded to a hairline rule with a pull-tab handle hanging into the
          // gutter — minimal footprint, but an obvious way back to the roster.
          <div className="relative lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
            <div className="absolute inset-y-0 left-0 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="Show patient list"
              aria-label="Show patient list"
              className="absolute left-0 top-1 flex h-14 w-6 items-center justify-center rounded-r-md border border-l-0 border-border bg-surface text-muted shadow-sm transition hover:bg-background hover:text-foreground"
            >
              <span aria-hidden className="text-lg leading-none">
                ›
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-3 lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
            <div className="flex h-full flex-col">
              {hasSelection && (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Collapse patient list"
                    className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted transition hover:bg-background hover:text-foreground"
                  >
                    <span aria-hidden>‹</span> Collapse
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <PatientRail
                  initialPatients={patients}
                  onNavigate={() => setExpanded(false)}
                />
              </div>
            </div>
          </div>
        )}
      </aside>
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
