"use client";

import { useState } from "react";

import type { MedicationHistoryEntry } from "@/lib/fhir/medication-types";
import { formatDate, relativeFromNow } from "@/lib/utils/format";

/**
 * The medications prescribed against a care plan's condition.
 *
 * Chronic plans accumulate a long tail of identical annual refills, so this
 * leads with what's currently prescribed and collapses the rest — same
 * active-first / discoverable-history pattern as the other sections.
 *
 * It also reports each drug's observed renewal cadence: a long-running script
 * renewed like clockwork is the norm for chronic management, and a break in
 * that rhythm is invisible from `status` alone (a MedicationRequest stays
 * "active" forever — nothing in the record ever expires it).
 */

const DAY_MS = 86_400_000;

interface Cadence {
  /** Typical (median) gap between prescriptions, in days. */
  intervalDays: number;
  count: number;
  firstWritten: number;
  lastWritten: number;
  daysSinceLast: number;
  /** When the next prescription would have fallen if the pattern had held. */
  expectedNext: number;
  /** The current gap has run past the established interval, allowing grace. */
  overdue: boolean;
}

/**
 * Infer a renewal rhythm from a drug's prescription history.
 *
 * Deliberately conservative — it only claims a cadence when the intervals are
 * genuinely regular, since a pattern asserted from noisy data would be worse
 * than saying nothing. Returns null unless there are at least three
 * prescriptions whose gaps all sit within 25% of the median.
 */
function inferCadence(history: MedicationHistoryEntry[]): Cadence | null {
  const written = history
    .map((m) => (m.dateWritten ? new Date(m.dateWritten).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (written.length < 3) return null;

  const gaps = written.slice(1).map((t, i) => (t - written[i]) / DAY_MS);
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

  // Ignore same-visit bursts — those aren't a renewal rhythm.
  if (median < 20) return null;
  if (!gaps.every((gap) => Math.abs(gap - median) <= median * 0.25)) return null;

  const lastWritten = written[written.length - 1];
  const daysSinceLast = Math.floor((Date.now() - lastWritten) / DAY_MS);

  // How far past the interval counts as a break in the pattern depends on how
  // regular the pattern is: against eight consecutive 365-day gaps, arriving a
  // month late is a real deviation, while a history that already wanders by
  // weeks earns proportionally more slack. A flat percentage would ignore that
  // and stay silent through a clearly missed annual renewal.
  const spread = Math.max(...gaps.map((gap) => Math.abs(gap - median)));
  const grace = Math.max(14, median * 0.05, spread * 2);

  return {
    intervalDays: median,
    count: written.length,
    firstWritten: written[0],
    lastWritten,
    daysSinceLast,
    expectedNext: lastWritten + median * DAY_MS,
    overdue: daysSinceLast > median + grace,
  };
}

const inMonths = (days: number): string => {
  const months = Math.round(days / 30.44);
  return months === 12 ? "12 months" : `${months} months`;
};

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * The cadence readout.
 *
 * Wording matters here: it reports what the record shows and stops. It never
 * says a refill is due — a gap in *this* record isn't proof of a gap in the
 * patient's care (she may have been renewed somewhere this server can't see),
 * so "no renewal recorded" prompts the right question without asserting an
 * answer we can't support. The judgement stays with the clinician.
 */
function CadenceNote({ cadence }: { cadence: Cadence }) {
  const pattern = `Renewed every ~${inMonths(cadence.intervalDays)} since ${formatDate(
    isoDay(cadence.firstWritten),
  )} · ${cadence.count} prescriptions`;

  if (!cadence.overdue) {
    return <p className="mt-1.5 text-xs text-muted">{pattern}</p>;
  }

  return (
    <div className="mt-2 rounded-md border border-sky-200 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/40 px-2.5 py-2">
      <p className="text-xs font-medium text-sky-900 dark:text-sky-200">
        No renewal recorded since {formatDate(isoDay(cadence.lastWritten))} —{" "}
        {relativeFromNow(new Date(cadence.lastWritten).toISOString())}.
      </p>
      <p className="mt-0.5 text-xs text-sky-800 dark:text-sky-300">
        {pattern}. On that pattern the next would have fallen around{" "}
        {formatDate(isoDay(cadence.expectedNext))}.
      </p>
    </div>
  );
}

function MedicationRow({
  med,
  active,
  cadence,
}: {
  med: MedicationHistoryEntry;
  active: boolean;
  cadence?: Cadence | null;
}) {
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-medium ${active ? "" : "text-muted"}`}>{med.medicationDescription}</p>
          <p className="mt-0.5 text-xs text-muted">
            {med.dateWritten ? `Written ${formatDate(med.dateWritten.slice(0, 10))}` : "Date unknown"}
            {med.prescriberName && ` · ${med.prescriberName}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          {med.status.replace(/-/g, " ")}
        </span>
      </div>
      {cadence && <CadenceNote cadence={cadence} />}
    </li>
  );
}

export function CarePlanMedications({ medications }: { medications: MedicationHistoryEntry[] }) {
  const [showPast, setShowPast] = useState(false);

  const written = (m: MedicationHistoryEntry) => new Date(m.dateWritten || 0).getTime();
  const byWrittenDesc = (a: MedicationHistoryEntry, b: MedicationHistoryEntry) =>
    written(b) - written(a);

  // Cadence is a property of a drug's whole history, so group first — the
  // active script alone can't show a rhythm.
  const cadenceByDrug = new Map<string, Cadence | null>();
  for (const med of medications) {
    const key = med.medicationDescription;
    if (!cadenceByDrug.has(key)) {
      cadenceByDrug.set(
        key,
        inferCadence(medications.filter((m) => m.medicationDescription === key)),
      );
    }
  }

  const current = medications.filter((m) => m.status === "active").sort(byWrittenDesc);
  const past = medications.filter((m) => m.status !== "active").sort(byWrittenDesc);

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Medications for this plan
        </h2>
        {past.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2.5 text-xs font-medium text-primary transition hover:bg-primary/5"
          >
            {showPast ? "Hide previous" : `Show previous (${past.length})`}
          </button>
        )}
      </div>

      {current.length === 0 ? (
        <p className="text-sm text-muted">Nothing currently prescribed for this plan.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {current.map((med) => (
            <MedicationRow
              key={med.medicationRequestId}
              med={med}
              active
              cadence={cadenceByDrug.get(med.medicationDescription)}
            />
          ))}
        </ul>
      )}

      {showPast && past.length > 0 && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Previously prescribed
          </p>
          <ul className="flex flex-col gap-2">
            {past.map((med) => (
              <MedicationRow key={med.medicationRequestId} med={med} active={false} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
