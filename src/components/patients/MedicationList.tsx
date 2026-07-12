"use client";

import { useState } from "react";

import type { MedicationHistoryEntry } from "@/lib/fhir/medication-types";
import { formatDate } from "@/lib/utils/format";

/**
 * Medications section for the patient detail page.
 *
 * By default it shows what a clinician needs at a glance: currently-active
 * medications plus anything carrying a detected issue (flagged first). The rest
 * of the medication history (completed, stopped, on-hold, …) collapses behind a
 * "Show full history" toggle.
 */

interface MedicationNameParts {
  /** The label to lead with — the brand name when RxNorm provides one. */
  primary: string;
  /** The full RxNorm name, always preserved for the secondary line / tooltip. */
  full: string;
  /** True when `primary` is a brand extracted from a trailing `[Brand]`. */
  hasBrand: boolean;
  /** True for RxNorm pack forms (GPCK/BPCK), e.g. "{…} Pack [Brand]". */
  isPack: boolean;
}

/**
 * Turn a raw RxNorm medication name into display parts, EHR-style.
 *
 * RxNorm encodes brand drugs and packs verbosely, e.g.
 *   "{7 (…0.18…) / 7 (…0.215…) / …} Pack [Trinessa 28 Day]"
 * The brand is the trailing `[…]`. We promote it to the primary label and keep
 * the full string as secondary detail (nothing is hidden). Generic clinical
 * drugs (no trailing brand) are returned unchanged.
 */
function formatMedicationName(raw: string): MedicationNameParts {
  const full = (raw ?? "").trim();
  const isPack = /\}\s*Pack\b/i.test(full);

  // RxNorm brand names are the trailing bracketed segment.
  const brand = full.match(/\[([^\]]+)\]\s*$/)?.[1]?.trim();

  return {
    primary: brand || full || "Unknown medication",
    full,
    hasBrand: Boolean(brand),
    isPack,
  };
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-slate-100 text-slate-700",
  stopped: "bg-slate-100 text-slate-700",
  "on-hold": "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-700",
  "entered-in-error": "bg-red-100 text-red-700",
  draft: "bg-blue-100 text-blue-700",
  unknown: "bg-slate-100 text-slate-600",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

function MedicationCard({ entry }: { entry: MedicationHistoryEntry }) {
  const flagged = Boolean(entry.detectedIssue);
  const name = formatMedicationName(entry.medicationDescription);
  const written = entry.dateWritten ? formatDate(entry.dateWritten.slice(0, 10)) : null;
  const ended = entry.dateEnded ? formatDate(entry.dateEnded.slice(0, 10)) : null;

  // Flagged meds always get the amber treatment so the flag UI is consistent
  // whether active or not. De-emphasis of a cancelled-but-flagged med comes
  // purely from its position (sorted to the bottom of the list).
  const cardTone = flagged ? "border-amber-300 bg-amber-50/60" : "border-border bg-surface";

  return (
    <li className={`rounded-lg border p-4 ${cardTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium">{name.primary}</p>
            {name.isPack && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Pack
              </span>
            )}
          </div>
          {name.hasBrand && (
            <p className="mt-0.5 text-xs text-muted" title={name.full}>
              {name.full}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {entry.prescriberName ? `Prescribed by ${entry.prescriberName}` : "Prescriber unknown"}
            {written && ` · ${written}`}
            {ended && ` – ${ended}`}
          </p>
        </div>
        <StatusBadge status={entry.status} />
      </div>

      {flagged && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-100/70 px-3 py-2 text-sm text-amber-900">
          <span aria-hidden>⚠️</span>
          <span>
            <span className="font-medium">Detected issue:</span> {entry.detectedIssue}
          </span>
        </div>
      )}
    </li>
  );
}

export function MedicationList({ entries }: { entries: MedicationHistoryEntry[] }) {
  const [showHistory, setShowHistory] = useState(false);

  // Default view: active meds + anything flagged, tiered so active flagged meds
  // lead and cancelled-but-flagged meds sink to the bottom (visible, so the
  // issue isn't lost, but not competing with what the patient is actually on).
  //   0: active + flagged   1: active   2: inactive + flagged
  const rank = (e: MedicationHistoryEntry) => {
    const active = e.status === "active";
    if (active && e.detectedIssue) return 0;
    if (active) return 1;
    return 2;
  };
  const primary = entries
    .filter((e) => e.status === "active" || e.detectedIssue)
    .sort((a, b) => rank(a) - rank(b));

  // Everything else lives behind the toggle.
  const history = entries.filter((e) => e.status !== "active" && !e.detectedIssue);

  const flaggedCount = entries.filter((e) => e.detectedIssue).length;

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Medications
          {flaggedCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {flaggedCount} flagged
            </span>
          )}
        </h2>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {showHistory ? "Hide history" : `Show full history (${history.length})`}
          </button>
        )}
      </div>

      {primary.length === 0 ? (
        <p className="text-sm text-muted">No active or flagged medications.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {primary.map((e) => (
            <MedicationCard key={e.medicationRequestId} entry={e} />
          ))}
        </ul>
      )}

      {showHistory && history.length > 0 && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">History</p>
          <ul className="flex flex-col gap-3">
            {history.map((e) => (
              <MedicationCard key={e.medicationRequestId} entry={e} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
