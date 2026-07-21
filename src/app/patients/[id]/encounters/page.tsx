import Link from "next/link";
import { notFound } from "next/navigation";

import { createEncounterAction } from "@/app/patients/encounter-actions";
import { EncounterStatusBadge } from "@/components/patients/EncounterStatusBadge";
import { CLINIC } from "@/lib/fhir/clinic";
import { FhirError } from "@/lib/fhir/client";
import type { EncounterView } from "@/lib/fhir/encounter-types";
import { listClinicEncounters } from "@/lib/fhir/encounters";
import { getPatientView } from "@/lib/fhir/patients";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function EncountersPage({
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

  const encounters = await listClinicEncounters(id).catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/patients/${id}`}
          className="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground"
        >
          ← Back to chart
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Encounters</h1>
          <p className="text-sm text-muted">
            {patient.fullName} · {CLINIC.name}
          </p>
        </div>
        <form action={createEncounterAction.bind(null, id)} className="contents">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:self-auto"
          >
            <span aria-hidden>＋</span> Create encounter
          </button>
        </form>
      </div>

      {encounters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          No encounters recorded at this clinic yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {encounters.map((encounter) => (
            <EncounterRow key={encounter.id} patientId={id} encounter={encounter} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EncounterRow({ patientId, encounter }: { patientId: string; encounter: EncounterView }) {
  const started = encounter.start ? formatDate(encounter.start.slice(0, 10)) : "Date unknown";
  return (
    <li>
      <Link
        href={`/patients/${patientId}/encounters/${encounter.id}`}
        className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40 hover:bg-background"
      >
        <div className="min-w-0">
          <p className="font-medium group-hover:text-primary">
            {encounter.typeText ?? "Encounter"}
          </p>
          <p className="mt-0.5 text-xs text-muted">{started}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <EncounterStatusBadge status={encounter.status} />
          <span aria-hidden className="text-muted transition group-hover:text-primary">
            ›
          </span>
        </div>
      </Link>
    </li>
  );
}
