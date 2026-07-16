import Link from "next/link";
import { notFound } from "next/navigation";

import { CarePlanList } from "@/components/patients/CarePlanList";
import { ConditionList } from "@/components/patients/ConditionList";
import { MedicationAllergies } from "@/components/patients/MedicationAllergies";
import { MedicationList } from "@/components/patients/MedicationList";
import { VitalsSection } from "@/components/patients/VitalsHistoryComponent";
import { FhirError } from "@/lib/fhir/client";
import type { ConditionView } from "@/lib/fhir/condition-types";
import { getConditions } from "@/lib/fhir/conditions";
import type { MedicationHistoryEntry } from "@/lib/fhir/medication-types";
import { listMedications } from "@/lib/fhir/medications";
import { getPatientView } from "@/lib/fhir/patients";
import { ageFromBirthDate, formatDate, titleCase } from "@/lib/utils/format";
import { listCarePlans } from "@/lib/fhir/care-plan";
import { CarePlanListItem } from "@/lib/fhir/care-plan-types";

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

  let medications: MedicationHistoryEntry[] = [];
  let medsError: string | null = null;
  try {
    medications = await listMedications(id);
  } catch (err) {
    medsError = err instanceof FhirError ? err.message : "Could not load medications.";
  }

  let conditions: ConditionView[] = [];
  let conditionsError: string | null = null;
  try {
    conditions = await getConditions(id);
  } catch (err) {
    conditionsError = err instanceof FhirError ? err.message : "Could not load conditions.";
  }

  let carePlans: CarePlanListItem[] = [];
  let carePlansError: string | null = null;
  try {
    carePlans = await listCarePlans(id);
  } catch (err) {
    carePlansError = err instanceof FhirError ? err.message : "Could not load care plans.";
  }

  const age = ageFromBirthDate(patient.birthDate);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/patients" className="text-sm text-muted hover:text-foreground">
          ← Back to patients
        </Link>
      </div>

      {/* Demographics header */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
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
        <Link
          href={`/patients/${id}/edit`}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-border px-3.5 py-2 text-sm font-medium transition hover:bg-background sm:self-auto"
        >
          Edit patient
        </Link>
      </div>

      <DemographicsGrid patient={patient} />

      <div className="flex flex-col gap-3">
        <MedicationAllergies patientId={id} />
        {medsError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {medsError}
          </div>
        ) : (
          <MedicationList entries={medications} />
        )}
      </div>

      <VitalsSection patientId={id} />

      {conditionsError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {conditionsError}
        </div>
      ) : (
        <ConditionList conditions={conditions} />
      )}

      {carePlansError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {carePlansError}
        </div>
      ) : (
        <CarePlanList plans={carePlans} />
      )}
    </div>
  );
}

function DemographicsGrid({
  patient,
}: {
  patient: Awaited<ReturnType<typeof getPatientView>>;
}) {
  const items = [
    { label: "First name", value: patient.firstName || "—" },
    { label: "Last name", value: patient.lastName || "—" },
    { label: "Gender", value: titleCase(patient.gender) },
    { label: "Date of birth", value: formatDate(patient.birthDate) },
    { label: "Patient ID", value: patient.id },
  ];
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
        Demographics
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs uppercase tracking-wide text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}
