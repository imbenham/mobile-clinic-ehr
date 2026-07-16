/**
 * Care plan status pill. Deliberately not a client component — it's pure
 * presentation, so both the (client) list and the (server) detail page can
 * share it and stay visually consistent.
 */

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  "on-hold": "bg-amber-100 text-amber-800",
  draft: "bg-blue-100 text-blue-700",
  completed: "bg-slate-100 text-slate-600",
  unknown: "bg-slate-100 text-slate-600",
};

export function CarePlanStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/-/g, " ")}
    </span>
  );
}
