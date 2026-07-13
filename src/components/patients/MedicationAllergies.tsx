import { FhirError } from "@/lib/fhir/client";
import { getMedicationAllergies, type AllergyView } from "@/lib/fhir/allergies";

/**
 * Server component: medication-allergy banner shown above the medication list.
 *
 * Allergies are safety-critical, so this reads loudly when present and still
 * states "No known medication allergies" when absent (NKDA is meaningful — it
 * tells the clinician allergies were checked, not just missing).
 */
export async function MedicationAllergies({ patientId }: { patientId: string }) {
  let allergies: AllergyView[] = [];
  let error: string | null = null;
  try {
    allergies = await getMedicationAllergies(patientId);
  } catch (err) {
    error = err instanceof FhirError ? err.message : "Could not load medication allergies.";
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (allergies.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm text-muted">
        <span aria-hidden>✓</span> No known medication allergies
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-300 bg-red-50/70 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span aria-hidden>⚠️</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-red-800">
          Medication allergies ({allergies.length})
        </h3>
      </div>
      <ul className="flex flex-col gap-2">
        {allergies.map((a) => (
          <AllergyRow key={a.id} allergy={a} />
        ))}
      </ul>
    </div>
  );
}

function AllergyRow({ allergy }: { allergy: AllergyView }) {
  const high = allergy.criticality === "high";
  const criticalityLabel =
    allergy.criticality === "unable-to-assess"
      ? "risk unknown"
      : allergy.criticality
        ? `${allergy.criticality} risk`
        : null;

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md bg-white/70 px-3 py-2 text-sm">
      <span className="font-semibold text-red-900">{allergy.substance}</span>

      {criticalityLabel && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            high ? "bg-red-200 text-red-900" : "bg-amber-100 text-amber-800"
          }`}
        >
          {criticalityLabel}
        </span>
      )}

      {allergy.reactions.length > 0 && (
        <span className="text-red-800">
          → {allergy.reactions.join(", ")}
          {allergy.severity && ` (${allergy.severity})`}
        </span>
      )}

      {allergy.clinicalStatus && allergy.clinicalStatus !== "active" && (
        <span className="text-xs text-muted">· {allergy.clinicalStatus}</span>
      )}
      {allergy.verificationStatus === "unconfirmed" && (
        <span className="text-xs italic text-muted">· unconfirmed</span>
      )}
    </li>
  );
}
