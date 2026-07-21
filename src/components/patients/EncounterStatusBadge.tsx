/** Encounter status pill — shared by the list and detail views. */

const STATUS_STYLES: Record<string, string> = {
  "in-progress": "bg-green-100 text-green-800",
  finished: "bg-slate-100 text-slate-600",
  planned: "bg-blue-100 text-blue-700",
  arrived: "bg-blue-100 text-blue-700",
  triaged: "bg-blue-100 text-blue-700",
  onleave: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-700",
  unknown: "bg-slate-100 text-slate-600",
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  const label = status === "in-progress" ? "In progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}
