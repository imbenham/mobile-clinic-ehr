import { listCarePlans } from "@/lib/fhir/care-plan";
import type { CarePlanListItem } from "@/lib/fhir/care-plan-types";
import { FhirError } from "@/lib/fhir/client";
import type { ConditionView } from "@/lib/fhir/condition-types";
import { getConditions } from "@/lib/fhir/conditions";
import type { ImmunizationRecord } from "@/lib/fhir/immunization-types";
import { getImmunizations } from "@/lib/fhir/immunizations";
import type { MedicationHistoryEntry } from "@/lib/fhir/medication-types";
import { listMedications } from "@/lib/fhir/medications";
import type { PatientView } from "@/lib/fhir/patient-types";
import { formatDate, titleCase } from "@/lib/utils/format";

import { CarePlanList } from "./CarePlanList";
import { ConditionList } from "./ConditionList";
import { ImmunizationList } from "./ImmunizationList";
import { MedicationAllergies } from "./MedicationAllergies";
import { MedicationList } from "./MedicationList";
import { SectionNav } from "./SectionNav";
import { VitalsSection } from "./VitalsHistoryComponent";

/**
 * The read-only body of a patient chart: section nav plus demographics,
 * medications, vitals, conditions, and care plans. Shared by the patient detail
 * page and the encounter detail view so the two can't drift apart.
 *
 * Expects to render inside an `@container` ancestor (the grids use container
 * queries to respond to pane width).
 */

const SECTIONS = [
  { id: "demographics", label: "Demographics" },
  { id: "medications", label: "Medications" },
  { id: "conditions", label: "Conditions" },
  { id: "care-plans", label: "Care plans" },
  { id: "vitals", label: "Vitals" },
  { id: "immunizations", label: "Immunizations" },
];

export async function PatientChartBody({
  patient,
  encounter,
}: {
  patient: PatientView;
  /** When set, the vitals section becomes an editable encounter-charting view. */
  encounter?: { id: string; active: boolean };
}) {
  const id = patient.id;

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

  let immunizations: ImmunizationRecord[] = [];
  let immunizationsError: string | null = null;
  try {
    immunizations = await getImmunizations(id);
  } catch (err) {
    immunizationsError = err instanceof FhirError ? err.message : "Could not load immunizations.";
  }

  let carePlans: CarePlanListItem[] = [];
  let carePlansError: string | null = null;
  try {
    carePlans = await listCarePlans(id);
  } catch (err) {
    carePlansError = err instanceof FhirError ? err.message : "Could not load care plans.";
  }

  return (
    <>
      <SectionNav sections={SECTIONS} />

      <section id="demographics" className="scroll-mt-20">
        <DemographicsGrid patient={patient} />
      </section>

      <section id="medications" className="scroll-mt-20 flex flex-col gap-3">
        <MedicationAllergies patientId={id} />
        {medsError ? (
          <ErrorBox message={medsError} />
        ) : (
          <MedicationList entries={medications} />
        )}
      </section>

      <section id="conditions" className="scroll-mt-20">
        {conditionsError ? <ErrorBox message={conditionsError} /> : <ConditionList conditions={conditions} />}
      </section>

      <section id="care-plans" className="scroll-mt-20">
        {carePlansError ? <ErrorBox message={carePlansError} /> : <CarePlanList plans={carePlans} />}
      </section>

      <section id="vitals" className="scroll-mt-20">
        <VitalsSection patientId={id} encounter={encounter} />
      </section>

      <section id="immunizations" className="scroll-mt-20">
        {immunizationsError ? (
          <ErrorBox message={immunizationsError} />
        ) : (
          <ImmunizationList immunizations={immunizations} />
        )}
      </section>
    </>
  );
}

function DemographicsGrid({ patient }: { patient: PatientView }) {
  const items = [
    { label: "First name", value: patient.firstName || "—" },
    { label: "Last name", value: patient.lastName || "—" },
    { label: "Gender", value: titleCase(patient.gender) },
    { label: "Date of birth", value: formatDate(patient.birthDate) },
    { label: "Patient ID", value: patient.id },
  ];
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Demographics</h2>
      <dl className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
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

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {message}
    </div>
  );
}
