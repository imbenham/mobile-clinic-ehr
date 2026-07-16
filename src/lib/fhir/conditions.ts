import "server-only";

import { fhirClient } from "./client";
import type { ConditionView } from "./condition-types";
import type { CodeableConcept, Condition } from "./resources";

/**
 * Conditions / diagnoses for a patient.
 *
 * Returns every non-errored condition flattened into a view model; splitting
 * active vs resolved for display happens in the UI (see ConditionList).
 */

// Trailing SNOMED semantic tags stripped for readability, e.g. "(disorder)".
const SNOMED_TAG =
  /\s*\((finding|disorder|situation|event|observable entity|morphologic abnormality|substance|product)\)\s*$/i;

function conceptText(concept?: CodeableConcept): string | undefined {
  const raw = concept?.text ?? concept?.coding?.[0]?.display ?? concept?.coding?.[0]?.code;
  return raw?.replace(SNOMED_TAG, "").trim() || undefined;
}

function statusCode(concept?: CodeableConcept): string | undefined {
  return concept?.coding?.[0]?.code;
}

function toConditionView(resource: Condition): ConditionView {
  return {
    id: resource.id ?? "",
    name: conceptText(resource.code) ?? "Unknown condition",
    code: resource.code?.coding?.[0]?.code,
    clinicalStatus: statusCode(resource.clinicalStatus),
    verificationStatus: statusCode(resource.verificationStatus),
    onset: resource.onsetDateTime,
    abatement: resource.abatementDateTime,
    recordedDate: resource.recordedDate,
  };
}

/** Resolve specific conditions by id — e.g. the ones a care plan addresses. */
export async function getConditionsByIds(ids: string[]): Promise<ConditionView[]> {
  if (ids.length === 0) return [];

  const resources = await fhirClient.search<Condition>("Condition", {
    _id: ids.join(","),
    _count: ids.length,
  });

  return resources.map(toConditionView);
}

export async function getConditions(patientId: string): Promise<ConditionView[]> {
  const resources = await fhirClient.search<Condition>("Condition", {
    patient: patientId,
    "verification-status:not": ["entered-in-error", "refuted"],
    _count: 200,
  });

  return resources.map(toConditionView);
}
