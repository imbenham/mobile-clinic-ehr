import { VitalsGrid, type VitalsEditContext } from "@/components/patients/VitalsGrid";
import { FhirError } from "@/lib/fhir/client";
import { getEncounterVitals } from "@/lib/fhir/encounter-vitals";
import { getVitalsHistory } from "@/lib/fhir/vitals";
import type { VitalsEntry } from "@/lib/fhir/vitals-types";

/**
 * Vital-sign trends for a patient. In an encounter context, each writable vital
 * also gets a "this visit" input above its trend (see VitalsGrid edit mode),
 * prefilled with anything already recorded for the encounter.
 */
export async function VitalsSection({
  patientId,
  encounter,
}: {
  patientId: string;
  encounter?: { id: string; active: boolean };
}) {
  let data: Record<string, VitalsEntry[]> = {};
  let error: string | null = null;
  try {
    data = await getVitalsHistory(patientId);
  } catch (err) {
    error = err instanceof FhirError ? err.message : "Could not load vital signs.";
  }

  let edit: VitalsEditContext | undefined;
  if (encounter) {
    const initial = await getEncounterVitals(encounter.id).catch(() => ({}));
    edit = { patientId, encounterId: encounter.id, active: encounter.active, initial };
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Vital signs</h2>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <VitalsGrid data={data} edit={edit} />
      )}
    </section>
  );
}
