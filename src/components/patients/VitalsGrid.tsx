"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Line } from "react-chartjs-2";

import { saveEncounterVitalsAction } from "@/app/patients/encounter-actions";
import type { VitalReading } from "@/lib/fhir/encounter-vitals";
import {
  BP_VITAL,
  VITAL_DISPLAY,
  VitalsComponentNames,
  WRITABLE_VITALS,
  type VitalDisplayConfig,
  type VitalsEntry,
} from "@/lib/fhir/vitals-types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

/**
 * Vital signs, one small widget per category: the latest reading up top and a
 * Chart.js trend line below. Blood pressure renders as the EHR-standard dual
 * systolic/diastolic line; every other vital is a single trend line.
 *
 * With an `edit` context (encounter charting), each writable vital's widget also
 * gets a "this visit" input above its trend, so the clinician records a reading
 * with its history in view. Inputs auto-save (see useVitalsAutosave); every
 * writable vital gets a widget even with no prior readings, so there's always a
 * home for the input.
 */

/** Writable vitals indexed by their display name (e.g. "Heart Rate"). */
const WRITABLE_BY_NAME = new Map(
  WRITABLE_VITALS.flatMap((vital) => {
    const name = VitalsComponentNames[vital.loinc];
    return name ? [[name, vital] as const] : [];
  }),
);

export interface VitalsEditContext {
  patientId: string;
  encounterId: string;
  active: boolean;
  /** Prefill: writable-vital key → recorded value for this encounter. */
  initial: Record<string, string>;
}

export function VitalsGrid({
  data,
  edit,
}: {
  data: Record<string, VitalsEntry[]>;
  edit?: VitalsEditContext;
}) {
  const { values, setValue, status } = useVitalsAutosave(edit);

  const withHistory = Object.keys(data).filter(
    (name) => name in VITAL_DISPLAY && data[name].length > 0,
  );
  // In edit mode, always surface every writable vital (plus BP) so its input
  // has a home even with no prior readings.
  const editNames = new Set([...withHistory, ...WRITABLE_BY_NAME.keys(), BP_VITAL.name]);
  const names = (edit ? [...editNames] : withHistory)
    .filter((name) => name in VITAL_DISPLAY)
    .sort((a, b) => VITAL_DISPLAY[a].order - VITAL_DISPLAY[b].order);

  if (names.length === 0) {
    return <p className="text-sm text-muted">No vital signs recorded for this patient.</p>;
  }

  const bmi = edit ? bmiFrom(values) : null;

  return (
    <div className="flex flex-col gap-3">
      {edit?.active && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Enter this visit&rsquo;s readings — they save automatically.
          </p>
          <SaveStatus status={status} />
        </div>
      )}

      <div className="grid gap-4 @lg:grid-cols-2 @5xl:grid-cols-3">
        {names.map((name) => {
          const entries = data[name] ?? [];

          if (edit && name === BP_VITAL.name) {
            return (
              <VitalWidget
                key={name}
                name={name}
                entries={entries}
                bp={{
                  systolic: values[BP_VITAL.systolic.key] ?? "",
                  diastolic: values[BP_VITAL.diastolic.key] ?? "",
                  onSystolic: (v) => setValue(BP_VITAL.systolic.key, v),
                  onDiastolic: (v) => setValue(BP_VITAL.diastolic.key, v),
                  unit: BP_VITAL.unit,
                  step: BP_VITAL.step,
                  disabled: !edit.active,
                }}
              />
            );
          }

          const writable = edit ? WRITABLE_BY_NAME.get(name) : undefined;

          if (writable?.derived) {
            return (
              <VitalWidget
                key={name}
                name={name}
                entries={entries}
                derived={{ value: bmi !== null ? bmi.toFixed(1) : "—", unit: writable.unit }}
              />
            );
          }

          const input = writable
            ? {
                value: values[writable.key] ?? "",
                onChange: (v: string) => setValue(writable.key, v),
                unit: writable.unit,
                step: writable.step,
                disabled: !edit!.active,
              }
            : undefined;
          return <VitalWidget key={name} name={name} entries={entries} input={input} />;
        })}
      </div>
    </div>
  );
}

/** BMI from the current height (cm) & weight (kg) inputs; null if either is blank. */
function bmiFrom(values: Record<string, string>): number | null {
  const weight = Number(values.weight);
  const height = Number(values.height);
  if (!values.weight?.trim() || !values.height?.trim()) return null;
  if (Number.isNaN(weight) || Number.isNaN(height) || height <= 0) return null;
  const metres = height / 100;
  return Math.round((weight / (metres * metres)) * 10) / 10;
}

const SAVE_DEBOUNCE_MS = 1200;
type SaveState = "idle" | "saving" | "saved";

/**
 * Auto-save controller for encounter vitals. No-ops entirely when `edit` is
 * absent (the read-only patient chart). Saves a beat after editing stops and
 * flushes on the way out — unmount, page hide, and when the encounter closes.
 * Upsert semantics (see the server action) make repeated saves safe.
 */
function useVitalsAutosave(edit: VitalsEditContext | undefined) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(edit?.initial ?? {}) }));
  const [status, setStatus] = useState<SaveState>("idle");

  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  const savedRef = useRef<Record<string, string>>({ ...(edit?.initial ?? {}) });

  const active = edit?.active ?? false;
  const patientId = edit?.patientId;
  const encounterId = edit?.encounterId;

  const collectChanged = useCallback(() => {
    const current = valuesRef.current;
    const saved = savedRef.current;
    const changed: VitalReading[] = [];

    for (const vital of WRITABLE_VITALS) {
      if (vital.derived) continue; // BMI handled below
      const raw = (current[vital.key] ?? "").trim();
      if (raw === (saved[vital.key] ?? "").trim()) continue;
      const num = Number(raw);
      if (raw === "" || Number.isNaN(num)) continue;
      changed.push({ key: vital.key, value: num });
    }

    // Derived BMI — save the computed value when it changes.
    const bmi = bmiFrom(current);
    if (bmi !== null && String(bmi) !== (saved.bmi ?? "")) {
      changed.push({ key: "bmi", value: bmi });
    }

    // Blood pressure — a pair; only saved once both are present.
    const sys = (current[BP_VITAL.systolic.key] ?? "").trim();
    const dia = (current[BP_VITAL.diastolic.key] ?? "").trim();
    const bpChanged =
      sys !== (saved[BP_VITAL.systolic.key] ?? "").trim() ||
      dia !== (saved[BP_VITAL.diastolic.key] ?? "").trim();
    if (bpChanged && sys && dia && !Number.isNaN(Number(sys)) && !Number.isNaN(Number(dia))) {
      changed.push({ key: "bloodPressure", systolic: Number(sys), diastolic: Number(dia) });
    }

    return changed;
  }, []);

  const persist = useCallback(async () => {
    if (!patientId || !encounterId) return;
    const changed = collectChanged();
    if (changed.length === 0) return;

    for (const reading of changed) {
      if ("systolic" in reading) {
        savedRef.current[BP_VITAL.systolic.key] = valuesRef.current[BP_VITAL.systolic.key] ?? "";
        savedRef.current[BP_VITAL.diastolic.key] = valuesRef.current[BP_VITAL.diastolic.key] ?? "";
      } else if (reading.key === "bmi") {
        savedRef.current.bmi = String(reading.value);
      } else {
        savedRef.current[reading.key] = valuesRef.current[reading.key] ?? "";
      }
    }
    await saveEncounterVitalsAction(patientId, encounterId, changed);
  }, [collectChanged, patientId, encounterId]);

  // Debounced save while editing.
  useEffect(() => {
    if (!active || collectChanged().length === 0) return;
    const timer = setTimeout(async () => {
      setStatus("saving");
      await persist();
      setStatus("saved");
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [values, active, collectChanged, persist]);

  // Flush on the way out: unmount (in-app navigation) and page hide.
  useEffect(() => {
    if (!patientId) return;
    const flush = () => {
      if (collectChanged().length > 0) void persist();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [patientId, collectChanged, persist]);

  // Flush pending edits the moment the encounter closes.
  useEffect(() => {
    if (edit && !active && collectChanged().length > 0) void persist();
  }, [edit, active, collectChanged, persist]);

  const setValue = useCallback(
    (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value })),
    [],
  );

  return { values, setValue, status };
}

function SaveStatus({ status }: { status: SaveState }) {
  if (status === "idle") return null;
  return <span className="text-xs text-muted">{status === "saving" ? "Saving…" : "Saved"}</span>;
}

interface TrendDataset {
  label: string;
  data: (number | null)[];
  color: string;
}

interface VitalInput {
  value: string;
  onChange: (value: string) => void;
  unit: string;
  step: string;
  disabled: boolean;
}

interface BpInput {
  systolic: string;
  diastolic: string;
  onSystolic: (value: string) => void;
  onDiastolic: (value: string) => void;
  unit: string;
  step: string;
  disabled: boolean;
}

// Accent-tinted so the entry fields stand out from the white card. Built on the
// `primary` token, so it re-colours with whatever palette is active.
const ENTRY_INPUT_CLASS =
  "min-h-11 w-full rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium tabular-nums text-foreground outline-none transition placeholder:font-normal placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/25 disabled:border-border disabled:bg-background disabled:font-normal disabled:text-muted";

const ENTRY_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-primary";

function VitalWidget({
  name,
  entries,
  input,
  derived,
  bp,
}: {
  name: string;
  entries: VitalsEntry[];
  input?: VitalInput;
  derived?: { value: string; unit: string };
  bp?: BpInput;
}) {
  const cfg = VITAL_DISPLAY[name];
  const isBP = name === "Blood Pressure";
  const hasHistory = entries.length > 0;

  // History runs newest-first from the server; chart oldest → newest.
  const series = [...entries].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
  );
  const latest = series[series.length - 1];
  const labels = series.map((e) => shortDate(e.takenAt));

  let display = "—";
  let datasets: TrendDataset[] = [];
  let status: RangeStatus = null;

  if (hasHistory && isBP) {
    const sys = series.map((e) => componentValue(e, "Systolic"));
    const dia = series.map((e) => componentValue(e, "Diastolic"));
    const latestSys = componentValue(latest, "Systolic");
    const latestDia = componentValue(latest, "Diastolic");
    display = latestSys != null && latestDia != null ? `${latestSys}/${latestDia}` : "—";
    datasets = [
      { label: "Systolic", data: sys, color: cfg.color },
      { label: "Diastolic", data: dia, color: "#60a5fa" },
    ];
  } else if (hasHistory) {
    display = formatValue(latest.value, cfg.precision);
    datasets = [{ label: name, data: series.map((e) => e.value), color: cfg.color }];
    status = rangeStatus(latest.value, cfg);
  }

  const unit = cfg.unit ?? (hasHistory ? latest.unit : input?.unit) ?? "";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{name}</h3>
        {hasHistory && <span className="text-[11px] text-muted">{longDate(latest.takenAt)}</span>}
      </div>

      {hasHistory ? (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className={`text-2xl font-semibold tabular-nums ${STATUS_TEXT[status ?? "none"]}`}>
            {display}
          </span>
          {unit && <span className="text-sm text-muted">{unit}</span>}
          {status && status !== "normal" && (
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[status]}`}
            >
              {status}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">No prior readings</p>
      )}

      {input && (
        <div className="mt-3">
          <span className={ENTRY_LABEL_CLASS}>This visit</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step={input.step}
              disabled={input.disabled}
              value={input.value}
              onChange={(e) => input.onChange(e.target.value)}
              placeholder="—"
              aria-label={`${name} this visit (${input.unit})`}
              className={ENTRY_INPUT_CLASS}
            />
            <span className="shrink-0 text-xs text-muted">{input.unit}</span>
          </div>
        </div>
      )}

      {bp && (
        <div className="mt-3">
          <span className={ENTRY_LABEL_CLASS}>This visit</span>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              step={bp.step}
              disabled={bp.disabled}
              value={bp.systolic}
              onChange={(e) => bp.onSystolic(e.target.value)}
              placeholder="Sys"
              aria-label={`Systolic blood pressure this visit (${bp.unit})`}
              className={ENTRY_INPUT_CLASS}
            />
            <span aria-hidden className="text-muted">
              /
            </span>
            <input
              type="number"
              inputMode="decimal"
              step={bp.step}
              disabled={bp.disabled}
              value={bp.diastolic}
              onChange={(e) => bp.onDiastolic(e.target.value)}
              placeholder="Dia"
              aria-label={`Diastolic blood pressure this visit (${bp.unit})`}
              className={ENTRY_INPUT_CLASS}
            />
            <span className="shrink-0 text-xs text-muted">{bp.unit}</span>
          </div>
        </div>
      )}

      {derived && (
        <div className="mt-3">
          <span className={ENTRY_LABEL_CLASS}>This visit</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums">{derived.value}</span>
            <span className="text-xs text-muted">{derived.unit}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted">calculated</span>
          </div>
        </div>
      )}

      {hasHistory && (
        <div className="mt-3 h-24">
          <TrendChart labels={labels} datasets={datasets} showLegend={isBP} />
        </div>
      )}
    </div>
  );
}

/** Reactively track dark mode so chart gridlines/ticks recolor on toggle. */
function useIsDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("mc-mode-change", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("mc-mode-change", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => document.documentElement.getAttribute("data-mode") === "dark",
    () => false,
  );
}

function TrendChart({
  labels,
  datasets,
  showLegend,
}: {
  labels: string[];
  datasets: TrendDataset[];
  showLegend: boolean;
}) {
  const isDark = useIsDark();
  const gridColor = isDark ? "rgba(148,163,184,0.18)" : "#eef2f7";
  const tickColor = isDark ? "#94a3b8" : "#64748b";

  const data = {
    labels,
    datasets: datasets.map((d) => ({
      label: d.label,
      data: d.data,
      borderColor: d.color,
      backgroundColor: `${d.color}22`,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2,
      tension: 0.3,
      spanGaps: true,
      fill: false,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        display: showLegend,
        position: "bottom" as const,
        labels: { boxWidth: 8, boxHeight: 8, font: { size: 10 }, padding: 8, color: tickColor },
      },
      tooltip: { boxPadding: 4 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 4, color: tickColor },
      },
      y: {
        grid: { color: gridColor },
        ticks: { font: { size: 9 }, maxTicksLimit: 4, color: tickColor },
      },
    },
  };

  return <Line data={data} options={options} />;
}

// --- helpers ----------------------------------------------------------------

type RangeStatus = "low" | "normal" | "high" | null;

const STATUS_TEXT: Record<string, string> = {
  none: "text-foreground",
  normal: "text-foreground",
  low: "text-amber-600 dark:text-amber-400",
  high: "text-amber-600 dark:text-amber-400",
};

const STATUS_BADGE: Record<string, string> = {
  low: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200",
  high: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200",
  normal: "",
};

function rangeStatus(value: number, cfg: VitalDisplayConfig): RangeStatus {
  if (!cfg.normal) return null;
  const [low, high] = cfg.normal;
  if (value < low) return "low";
  if (value > high) return "high";
  return "normal";
}

function componentValue(entry: VitalsEntry, componentName: string): number | null {
  return entry.components?.find((c) => c.name === componentName)?.value ?? null;
}

function formatValue(value: number, precision: number): string {
  return value.toFixed(precision);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
