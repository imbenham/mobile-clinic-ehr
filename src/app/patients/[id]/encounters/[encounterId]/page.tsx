import Link from "next/link";
import { notFound } from "next/navigation";

import { finishEncounterAction } from "@/app/patients/encounter-actions";
import { EncounterStatusBadge } from "@/components/patients/EncounterStatusBadge";
import { PatientChartBody } from "@/components/patients/PatientChartBody";
import { FhirError } from "@/lib/fhir/client";
import { isEncounterActive } from "@/lib/fhir/encounter-types";
import { getEncounter } from "@/lib/fhir/encounters";
import { getPatientView } from "@/lib/fhir/patients";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function EncounterDetailPage({
  params,
}: {
  params: Promise<{ id: string; encounterId: string }>;
}) {
  const { id, encounterId } = await params;

  let encounter;
  try {
    encounter = await getEncounter(encounterId);
  } catch (err) {
    if (err instanceof FhirError && err.status === 404) notFound();
    throw err;
  }

  // The encounter must belong to the patient in the path.
  if (encounter.patientId !== id) notFound();

  let patient;
  try {
    patient = await getPatientView(id);
  } catch (err) {
    if (err instanceof FhirError && err.status === 404) notFound();
    throw err;
  }

  const active = isEncounterActive(encounter.status);

  return (
    <div className="@container flex flex-col gap-6">
      <div>
        <Link
          href={`/patients/${id}/encounters`}
          className="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground"
        >
          ← Back to encounters
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 @xl:flex-row @xl:items-center @xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {encounter.typeText ?? "Encounter"}
            </h1>
            <EncounterStatusBadge status={encounter.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {patient.fullName}
            {encounter.locationName && ` · ${encounter.locationName}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {encounter.start ? `Started ${formatDateTime(encounter.start)}` : "Start time unknown"}
            {encounter.end && ` · Ended ${formatDateTime(encounter.end)}`}
          </p>
        </div>

        {active && (
          <form
            action={finishEncounterAction.bind(null, id, encounterId)}
            className="contents"
          >
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-background @xl:self-auto"
            >
              Finish encounter
            </button>
          </form>
        )}
      </div>

      {active && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          This encounter is in progress — record vitals in the chart below and they&rsquo;ll be
          charted against it.
        </p>
      )}

      <PatientChartBody patient={patient} encounter={{ id: encounterId, active }} />
    </div>
  );
}
