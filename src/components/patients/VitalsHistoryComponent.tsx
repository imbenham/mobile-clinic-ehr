import { VitalsGrid } from "@/components/patients/VitalsGrid";
import { FhirError } from "@/lib/fhir/client";
import { getVitalsHistory } from "@/lib/fhir/vitals";
import type { VitalsEntry } from "@/lib/fhir/vitals-types";

export async function VitalsSection({ patientId }: { patientId: string }) {
  let data: Record<string, VitalsEntry[]> = {};
  let error: string | null = null;
  try {
    data = await getVitalsHistory(patientId);
  } catch (err) {
    error = err instanceof FhirError ? err.message : "Could not load vital signs.";
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
        <VitalsGrid data={data} />
      )}
    </section>
  );
}
