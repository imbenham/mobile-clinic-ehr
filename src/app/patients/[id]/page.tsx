import Link from "next/link";
import { notFound } from "next/navigation";

import { PatientChartBody } from "@/components/patients/PatientChartBody";
import { createEncounterAction } from "@/app/patients/encounter-actions";
import { FhirError } from "@/lib/fhir/client";
import { countClinicEncounters } from "@/lib/fhir/encounters";
import { getPatientView } from "@/lib/fhir/patients";
import { ageFromBirthDate, formatDate, titleCase } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let patient;
  try {
    patient = await getPatientView(id);
  } catch (err) {
    if (err instanceof FhirError && err.status === 404) notFound();
    throw err;
  }

  const age = ageFromBirthDate(patient.birthDate);
  const encounterCount = await countClinicEncounters(id).catch(() => 0);

  return (
    <div className="@container flex flex-col gap-6">
      {/* The rail already offers a way back in landscape, so this is portrait-only. */}
      <div className="lg:hidden">
        <Link
          href="/patients"
          className="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground"
        >
          ← All patients
        </Link>
      </div>

      {/* Demographics header */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 @xl:flex-row @xl:items-center @xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(patient.firstName, patient.lastName)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{patient.fullName}</h1>
            <p className="text-sm text-muted">
              {titleCase(patient.gender)} · {formatDate(patient.birthDate)}
              {age !== null && ` · ${age} yrs`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start @xl:self-auto">
          <Link
            href={`/patients/${id}/encounters`}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary transition hover:bg-background"
          >
            Encounters ({encounterCount})
          </Link>
          <form action={createEncounterAction.bind(null, id)} className="contents">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <span aria-hidden>＋</span> Create encounter
            </button>
          </form>
          <Link
            href={`/patients/${id}/edit`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-background"
          >
            Edit patient
          </Link>
        </div>
      </div>

      <PatientChartBody patient={patient} />
    </div>
  );
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}
