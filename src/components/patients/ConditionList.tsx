"use client";

import { useState, type ReactNode } from "react";

import {
  isActiveCondition,
  isSocialCondition,
  type ConditionView,
} from "@/lib/fhir/condition-types";
import { formatDate } from "@/lib/utils/format";

/**
 * Conditions section for the patient detail page.
 *
 * Leads with the active clinical problem list. Two things are kept discoverable
 * but out of the way so they don't crowd the primary context:
 *   - Social & lifestyle findings (employment, education, …) — current, but
 *     context rather than diagnoses.
 *   - Resolved / inactive conditions — historical.
 */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300",
  recurrence: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200",
  relapse: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200",
  remission: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
  inactive: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
  resolved: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function ConditionRow({
  condition,
  active,
  showStatus = true,
}: {
  condition: ConditionView;
  active: boolean;
  showStatus?: boolean;
}) {
  const onset = condition.onset ? formatDate(condition.onset.slice(0, 10)) : null;
  const abatement = condition.abatement ? formatDate(condition.abatement.slice(0, 10)) : null;

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="min-w-0">
        <p className={`font-medium ${active ? "" : "text-muted"}`}>{condition.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {active
            ? onset
              ? `Since ${onset}`
              : "Onset unknown"
            : onset && abatement
              ? `${onset} – ${abatement}`
              : abatement
                ? `Resolved ${abatement}`
                : onset
                  ? `Onset ${onset}`
                  : "Dates unknown"}
        </p>
      </div>
      {showStatus && <StatusBadge status={condition.clinicalStatus} />}
    </li>
  );
}

function Subsection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-1.5 rounded-md text-xs font-medium uppercase tracking-wide text-muted transition hover:text-foreground"
      >
        <span className="text-[10px] leading-none">{open ? "▾" : "▸"}</span>
        {label} ({count})
      </button>
      {open && <ul className="mt-3 flex flex-col gap-2">{children}</ul>}
    </div>
  );
}

export function ConditionList({ conditions }: { conditions: ConditionView[] }) {
  const [showSocial, setShowSocial] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const onsetTime = (c: ConditionView) => new Date(c.onset ?? c.recordedDate ?? 0).getTime();
  const byOnsetDesc = (a: ConditionView, b: ConditionView) => onsetTime(b) - onsetTime(a);

  const activeConditions = conditions.filter(isActiveCondition);
  const clinical = activeConditions.filter((c) => !isSocialCondition(c)).sort(byOnsetDesc);
  const social = activeConditions.filter(isSocialCondition).sort(byOnsetDesc);
  const resolved = conditions
    .filter((c) => !isActiveCondition(c))
    .sort((a, b) => new Date(b.abatement ?? 0).getTime() - new Date(a.abatement ?? 0).getTime());

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Conditions</h2>
        <span className="text-xs text-muted/70">{clinical.length} active</span>
      </div>

      {clinical.length === 0 ? (
        <p className="text-sm text-muted">No active clinical conditions.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clinical.map((c) => (
            <ConditionRow key={c.id} condition={c} active />
          ))}
        </ul>
      )}

      {social.length > 0 && (
        <Subsection
          label="Social & lifestyle"
          count={social.length}
          open={showSocial}
          onToggle={() => setShowSocial((v) => !v)}
        >
          {social.map((c) => (
            <ConditionRow key={c.id} condition={c} active showStatus={false} />
          ))}
        </Subsection>
      )}

      {resolved.length > 0 && (
        <Subsection
          label="Resolved"
          count={resolved.length}
          open={showResolved}
          onToggle={() => setShowResolved((v) => !v)}
        >
          {resolved.map((c) => (
            <ConditionRow key={c.id} condition={c} active={false} />
          ))}
        </Subsection>
      )}
    </section>
  );
}
