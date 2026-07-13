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
import { Line } from "react-chartjs-2";

import {
  VITAL_DISPLAY,
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
 */
export function VitalsGrid({ data }: { data: Record<string, VitalsEntry[]> }) {
  const names = Object.keys(data)
    .filter((name) => name in VITAL_DISPLAY && data[name].length > 0)
    .sort((a, b) => VITAL_DISPLAY[a].order - VITAL_DISPLAY[b].order);

  if (names.length === 0) {
    return <p className="text-sm text-muted">No vital signs recorded for this patient.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {names.map((name) => (
        <VitalWidget key={name} name={name} entries={data[name]} />
      ))}
    </div>
  );
}

interface TrendDataset {
  label: string;
  data: (number | null)[];
  color: string;
}

function VitalWidget({ name, entries }: { name: string; entries: VitalsEntry[] }) {
  const cfg = VITAL_DISPLAY[name];
  const isBP = name === "Blood Pressure";

  // History runs newest-first from the server; chart oldest → newest.
  const series = [...entries].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
  );
  const latest = series[series.length - 1];
  const labels = series.map((e) => shortDate(e.takenAt));

  let display: string;
  let datasets: TrendDataset[];
  let status: RangeStatus = null;

  if (isBP) {
    const sys = series.map((e) => componentValue(e, "Systolic"));
    const dia = series.map((e) => componentValue(e, "Diastolic"));
    const latestSys = componentValue(latest, "Systolic");
    const latestDia = componentValue(latest, "Diastolic");
    display =
      latestSys != null && latestDia != null ? `${latestSys}/${latestDia}` : "—";
    datasets = [
      { label: "Systolic", data: sys, color: cfg.color },
      { label: "Diastolic", data: dia, color: "#60a5fa" },
    ];
  } else {
    display = formatValue(latest.value, cfg.precision);
    datasets = [{ label: name, data: series.map((e) => e.value), color: cfg.color }];
    status = rangeStatus(latest.value, cfg);
  }

  const unit = cfg.unit ?? latest.unit ?? "";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{name}</h3>
        <span className="text-[11px] text-muted">{longDate(latest.takenAt)}</span>
      </div>

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

      <div className="mt-3 h-24">
        <TrendChart labels={labels} datasets={datasets} showLegend={isBP} />
      </div>
    </div>
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
        labels: { boxWidth: 8, boxHeight: 8, font: { size: 10 }, padding: 8 },
      },
      tooltip: { boxPadding: 4 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 4 },
      },
      y: {
        grid: { color: "#eef2f7" },
        ticks: { font: { size: 9 }, maxTicksLimit: 4 },
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
  low: "text-amber-600",
  high: "text-amber-600",
};

const STATUS_BADGE: Record<string, string> = {
  low: "bg-amber-100 text-amber-800",
  high: "bg-amber-100 text-amber-800",
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
