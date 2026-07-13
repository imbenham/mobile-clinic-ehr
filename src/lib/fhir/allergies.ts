import "server-only";

import { fhirClient } from "./client";
import type { AllergyIntolerance, CodeableConcept } from "./resources";

/**
 * Medication allergies for the patient, for display alongside their meds.
 *
 * Flattens the FHIR AllergyIntolerance resource into the few fields a clinician
 * needs at a glance: the allergen, how dangerous a reaction could be, and what
 * the reaction looks like.
 */

export interface AllergyView {
  id: string;
  /** The allergen — usually a drug or drug class. */
  substance: string;
  /** 'low' | 'high' | 'unable-to-assess' — potential clinical harm. */
  criticality?: string;
  /** 'allergy' | 'intolerance'. */
  type?: string;
  /** 'active' | 'inactive' | 'resolved'. */
  clinicalStatus?: string;
  /** 'unconfirmed' | 'confirmed' | 'presumed' … (refuted/errored are filtered out). */
  verificationStatus?: string;
  /** Known reactions/manifestations, e.g. "Hives", "Anaphylaxis". */
  reactions: string[];
  /** Worst recorded reaction severity: 'mild' | 'moderate' | 'severe'. */
  severity?: string;
  recordedDate?: string;
}

const SEVERITY_RANK: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };

// Trailing SNOMED semantic tags we strip for readability, e.g. "(finding)".
const SNOMED_TAG =
  /\s*\((finding|disorder|situation|event|observable entity|morphologic abnormality|substance|product)\)\s*$/i;

function conceptText(concept?: CodeableConcept): string | undefined {
  const raw = concept?.text ?? concept?.coding?.[0]?.display ?? concept?.coding?.[0]?.code;
  return raw?.replace(SNOMED_TAG, "").trim() || undefined;
}

function statusCode(concept?: CodeableConcept): string | undefined {
  return concept?.coding?.[0]?.code;
}

function toAllergyView(resource: AllergyIntolerance): AllergyView {
  const reactions = (resource.reaction ?? []).flatMap(
    (r) => r.manifestation?.map((m) => conceptText(m)).filter((v): v is string => Boolean(v)) ?? [],
  );

  // Worst severity across all reactions.
  type Severity = "mild" | "moderate" | "severe";
  const severity = (resource.reaction ?? [])
    .map((r) => r.severity)
    .filter((s): s is Severity => Boolean(s))
    .sort((a, b) => (SEVERITY_RANK[b] ?? 0) - (SEVERITY_RANK[a] ?? 0))[0];

  return {
    id: resource.id ?? "",
    substance: conceptText(resource.code) ?? "Unknown allergen",
    criticality: resource.criticality,
    type: resource.type,
    clinicalStatus: statusCode(resource.clinicalStatus),
    verificationStatus: statusCode(resource.verificationStatus),
    reactions: Array.from(new Set(reactions)),
    severity,
    recordedDate: resource.recordedDate,
  };
}

/**
 * Fetch a patient's active medication allergies, excluding those that have been
 * refuted or entered in error (the challenge's `verification-status:not` query).
 */
export async function getMedicationAllergies(patientId: string): Promise<AllergyView[]> {
  const resources = await fhirClient.search<AllergyIntolerance>("AllergyIntolerance", {
    patient: patientId,
    category: "medication",
    "verification-status:not": ["refuted", "entered-in-error"],
  });

  return resources.map(toAllergyView);
}
