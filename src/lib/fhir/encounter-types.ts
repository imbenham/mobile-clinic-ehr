/** Client-safe encounter view model + status helper. */

export interface EncounterView {
  id: string;
  patientId: string;
  /** FHIR Encounter.status: in-progress | finished | planned | … */
  status: string;
  start?: string;
  end?: string;
  /** Human label for the visit, e.g. "Mobile clinic visit". */
  typeText?: string;
  locationName?: string;
}

/**
 * An encounter is "active" (open for charting) only while in progress. FHIR has
 * no `active` status for Encounter — `in-progress` is the equivalent.
 */
export function isEncounterActive(status: string): boolean {
  return status === "in-progress";
}
