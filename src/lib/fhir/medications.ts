import { fhirClient } from "./client";
import { MedicationHistoryEntry } from "./medication-types";
import { MedicationRequest, Medication, CodeableConcept } from "./resources";

/**
 * List patients, optionally filtered by name.
 * FHIR's `name` search parameter matches given OR family name.
 */
/*interface ListMedicationsParams {
  patientId?: string;
}*/
export async function listMedications(patientId?: string): Promise<MedicationHistoryEntry[]> {
  const allResources = await fhirClient.search<MedicationRequest | Medication>("MedicationRequest", {
    patient: patientId,
    _include: 'MedicationRequest:medication',
  });
  const medicationMap: Record<string, Medication> = {};

  const requests: MedicationRequest[] = [];

  for (const med of allResources) {
    if (med.resourceType === "Medication" && med.id) {
      medicationMap[med.id] = med;
    }
    if (med.resourceType === "MedicationRequest") {
      requests.push(med);
    }
  }

  const medicationHistory: MedicationHistoryEntry[] = [];

  requests.forEach((req) => {
    const entry = getMedicationInfo(req, medicationMap);
    if (entry) {
      medicationHistory.push(entry);
    }
  });
  // Drop entered-in-error / cancelled requests — UNLESS they carry a detected
  // issue, which is exactly the thing a clinician needs to see flagged.
  return medicationHistory.filter(
    (entry): entry is MedicationHistoryEntry =>
      (entry.status !== 'entered-in-error' && entry.status !== 'cancelled') ||
      Boolean(entry.detectedIssue),
  );
}

const getMedicationInfo = (medicationRequest: MedicationRequest, medicationMap:  Record<string, Medication>): MedicationHistoryEntry | null => {
  if (!medicationRequest.id) {
    return null;
  }
  const medResource = medicationRequest.medicationReference && medicationMap[medicationRequest.medicationReference.reference?.replace('Medication/', '') ?? ''];
  const medConcept = medicationRequest.medicationCodeableConcept;
  
  if (medResource) {
    return {
      medicationRequestId: medicationRequest.id || "",
      medicationDescription: getMedicationDescription(medResource, medicationRequest),
      status: medicationRequest.status,
      dateWritten: medicationRequest.authoredOn || '',
      dateEnded: medicationRequest.dispenseRequest?.validityPeriod?.end,
      prescriberName: medicationRequest.requester?.display,
      detectedIssue: getDetectedIssue(medicationRequest),
    };
  }
  if (medConcept) {
    return {
      medicationRequestId: medicationRequest.id || "",
      medicationDescription: getMedicationDescriptionFromCodeableConcept(medConcept, medicationRequest),
      status: medicationRequest.status,
      dateWritten: medicationRequest.authoredOn || '',
      dateEnded: medicationRequest.dispenseRequest?.validityPeriod?.end,
      prescriberName: medicationRequest.requester?.display,
      detectedIssue: getDetectedIssue(medicationRequest),
    };
  }

  // No medicationReference or medicationCodeableConcept we can describe.
  return null;
};

/**
 * Pull the best human-readable label out of a CodeableConcept:
 *   1. the free-text `text` (what a clinician actually typed/saw)
 *   2. a coding's `display` — preferring the one the user selected
 *   3. a raw `code` as a last resort
 * Returns undefined if the concept carries nothing usable.
 */
const codeableConceptText = (concept?: CodeableConcept): string | undefined => {
  if (!concept) return undefined;
  if (concept.text?.trim()) return concept.text.trim();

  const coding =
    concept.coding?.find((c) => c.userSelected && c.display?.trim()) ??
    concept.coding?.find((c) => c.display?.trim()) ??
    concept.coding?.[0];

  return coding?.display?.trim() || coding?.code || undefined;
};

/** Join the names of a Medication's ingredients, e.g. "Amoxicillin, Clavulanate". */
const ingredientsText = (medication: Medication): string | undefined => {
  const names = medication.ingredient
    ?.map(
      (ing) =>
        codeableConceptText(ing.itemCodeableConcept) ?? ing.itemReference?.display?.trim(),
    )
    .filter((n): n is string => Boolean(n));

  return names && names.length > 0 ? names.join(", ") : undefined;
};

// Describe the medication when the request inlines it as a CodeableConcept
// (request.medicationCodeableConcept). `request` is only a fallback source if
// the passed concept itself is empty.
const getMedicationDescriptionFromCodeableConcept = (medication: CodeableConcept, request: MedicationRequest): string => {
  return (
    codeableConceptText(medication) ??
    codeableConceptText(request.medicationCodeableConcept) ??
    request.medicationReference?.display?.trim() ??
    "Unknown medication"
  );
};

// Describe the medication behind a request that references a full Medication
// resource. Falls through Medication.code → ingredient list → whatever the
// request itself carries, so we always return something identifiable.
const getMedicationDescription = (medication: Medication, request: MedicationRequest): string => {
  return (
    codeableConceptText(medication.code) ??
    ingredientsText(medication) ??
    getMedicationDescriptionFromCodeableConcept(request.medicationCodeableConcept ?? {}, request)
  );
};

// Surface any detected issues (drug interactions, allergy alerts, duplicate
// therapy, etc.) attached to the request. `detectedIssue` is an array of
// References, so we can only show each issue's `display` text here; the full
// DetectedIssue resource (severity, detail, mitigation) would need a separate
// read of `ref.reference`. Returns undefined when there are none.
const getDetectedIssue = (medicationRequest: MedicationRequest): string | undefined => {
  const issues = medicationRequest.detectedIssue
    ?.map((ref) => ref.display?.trim() || ref.reference)
    .filter((v): v is string => Boolean(v));

  return issues && issues.length > 0 ? issues.join("; ") : undefined;
};

