"use client";

import { useState } from "react";

import type { ImmunizationRecord } from "@/lib/fhir/immunization-types";
import { formatDate, relativeFromNow } from "@/lib/utils/format";

/**
 * Immunization history, grouped by vaccine.
 *
 * A flat list would be dominated by repeat doses (annual flu shots), so doses of
 * the same vaccine collapse into one row showing the latest date and dose count;
 * expand to see every administration. Groups are ordered by most recent dose, so
 * recent vaccination activity surfaces first.
 */

interface VaccineGroup {
  key: string;
  name: string;
  dates: string[]; // newest first
}

function groupByVaccine(records: ImmunizationRecord[]): VaccineGroup[] {
  const groups = new Map<string, VaccineGroup>();
  for (const record of records) {
    const key = record.cvxCode ?? record.vaccineName;
    let group = groups.get(key);
    if (!group) {
      group = { key, name: record.vaccineName, dates: [] };
      groups.set(key, group);
    }
    if (record.date) group.dates.push(record.date);
  }

  const result = [...groups.values()];
  for (const group of result) group.dates.sort((a, b) => b.localeCompare(a));
  result.sort((a, b) => (b.dates[0] ?? "").localeCompare(a.dates[0] ?? ""));
  return result;
}

export function ImmunizationList({ immunizations }: { immunizations: ImmunizationRecord[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = groupByVaccine(immunizations);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Immunizations
          {groups.length > 0 && (
            <span className="ml-2 font-normal text-muted/70">{groups.length}</span>
          )}
        </h2>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">No immunizations recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <VaccineRow
              key={group.key}
              group={group}
              open={expanded.has(group.key)}
              onToggle={() => toggle(group.key)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VaccineRow({
  group,
  open,
  onToggle,
}: {
  group: VaccineGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const latest = group.dates[0];
  const doses = group.dates.length;
  const multi = doses > 1;
  const since = relativeFromNow(latest);

  const meta = (
    <p className="mt-0.5 text-xs text-muted">
      {latest ? `Latest ${formatDate(latest)}` : "Date unknown"}
      {since && ` · ${since}`}
      {multi && ` · ${doses} doses`}
    </p>
  );

  if (!multi) {
    return (
      <li className="rounded-lg border border-border bg-background p-3">
        <p className="font-medium">{group.name}</p>
        {meta}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-start justify-between gap-3 p-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium">{group.name}</p>
          {meta}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            ×{doses}
          </span>
          <span aria-hidden className="text-xs text-muted">
            {open ? "▾" : "▸"}
          </span>
        </div>
      </button>

      {open && (
        <ul className="border-t border-border px-3 py-2">
          {group.dates.map((date, i) => (
            <li key={`${date}-${i}`} className="flex justify-between py-1 text-xs text-muted">
              <span>Dose {doses - i}</span>
              <span>{formatDate(date)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
