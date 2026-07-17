"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { searchPatients } from "@/app/patients/actions";
import type { PatientView } from "@/lib/fhir/patient-types";
import { ageFromBirthDate, formatDate, formatLastNameFirst, titleCase } from "@/lib/utils/format";

/**
 * The patient list, as a navigable rail.
 *
 * Rendered in two places by the patients layout: as a persistent left column on
 * wide (landscape) screens, and as the full-width list on the index route for
 * narrow (portrait) screens. Either way it owns its own search so the roster can
 * be filtered without leaving whichever patient is open in the detail pane.
 *
 * Search runs server-side via a debounced action (see `searchPatients`) rather
 * than filtering a client-held list — so it holds up when the roster is larger
 * than the sandbox's ten records.
 */
export function PatientRail({
  initialPatients,
  onNavigate,
}: {
  initialPatients: PatientView[];
  /** Fired when a patient row is tapped — lets the workspace fold back to focus. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/patients/") ? pathname.split("/")[2] : undefined;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientView[] | null>(null);
  const [pending, setPending] = useState(false);
  // Guards against an earlier, slower search overwriting a later one.
  const requestId = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    // Empty query falls back to the server-rendered roster — no round trip.
    if (!trimmed) return;

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setPending(true);
      const found = await searchPatients(trimmed);
      if (id === requestId.current) {
        setResults(found);
        setPending(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // While a first search is still in flight, show the full roster dimmed rather
  // than an empty flash; a genuine zero-match result (`[]`) shows "no matches".
  const patients = trimmed ? results ?? initialPatients : initialPatients;
  const searching = pending && Boolean(trimmed);

  return (
    <div className="flex h-full flex-col">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search patients by name"
          className="min-h-11 w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {patients.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            {searching ? "Searching…" : "No patients match your search."}
          </p>
        ) : (
          <ul className={`flex flex-col gap-1 ${searching ? "opacity-60" : ""}`}>
            {patients.map((patient) => (
              <PatientRailRow
                key={patient.id}
                patient={patient}
                active={patient.id === activeId}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PatientRailRow({
  patient,
  active,
  onNavigate,
}: {
  patient: PatientView;
  active: boolean;
  onNavigate?: () => void;
}) {
  const age = ageFromBirthDate(patient.birthDate);
  const tone = active
    ? "border-primary/40 bg-primary/5"
    : "border-transparent hover:border-border hover:bg-background";

  return (
    <li>
      <Link
        href={`/patients/${patient.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 transition ${tone}`}
      >
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${active ? "text-primary" : ""}`}>
            {formatLastNameFirst(patient.firstName, patient.lastName)}
          </p>
          <p className="truncate text-xs text-muted">
            {titleCase(patient.gender)} · {formatDate(patient.birthDate)}
            {age !== null && ` · ${age} yrs`}
          </p>
        </div>
        <span aria-hidden className="shrink-0 text-muted">
          ›
        </span>
      </Link>
    </li>
  );
}
