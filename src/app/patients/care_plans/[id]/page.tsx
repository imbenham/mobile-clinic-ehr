import Link from "next/link";
import { notFound } from "next/navigation";

import { getCarePlan } from "@/lib/fhir/care-plan";
import { FhirError } from "@/lib/fhir/client";

export const dynamic = "force-dynamic";

/**
 * Care plan detail — STUB.
 *
 * `[id]` is the CarePlan id. For now this just confirms the plan loads and
 * links back to the patient; the full detail (goals, activities, care team,
 * addressed conditions, timeline) is TODO — to be designed with the user.
 */
export default async function CarePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let plan;
  try {
    plan = await getCarePlan(id);
  } catch (err) {
    if (err instanceof FhirError && err.status === 404) notFound();
    throw err;
  }

  const backHref = plan.patientId ? `/patients/${plan.patientId}` : "/patients";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={backHref} className="text-sm text-muted hover:text-foreground">
          ← Back to patient
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {plan.status.replace(/-/g, " ")}
          </span>
        </div>
        {plan.category && <p className="mt-1 text-sm text-muted">{plan.category}</p>}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-muted">
        Care plan detail — goals, activities, and care team — coming soon.
      </div>
    </div>
  );
}
