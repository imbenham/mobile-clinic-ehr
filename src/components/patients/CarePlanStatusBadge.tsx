/**
 * Care plan status pill. Deliberately not a client component — it's pure
 * presentation, so both the (client) list and the (server) detail page can
 * share it and stay visually consistent.
 */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300",
  "on-hold": "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200",
  draft: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  completed: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
  unknown: "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300",
};

export function CarePlanStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/-/g, " ")}
    </span>
  );
}
