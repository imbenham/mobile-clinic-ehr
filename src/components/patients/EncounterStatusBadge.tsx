/** Encounter status pill — shared by the list and detail views. */

const STATUS_STYLES: Record<string, string> = {
  "in-progress": "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300",
  finished: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
  planned: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  arrived: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  triaged: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  onleave: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200",
  cancelled: "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300",
  unknown: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300";
  const label = status === "in-progress" ? "In progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}
