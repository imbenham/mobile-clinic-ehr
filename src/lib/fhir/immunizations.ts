import "server-only";

import { fhirClient } from "./client";
import type { ImmunizationRecord } from "./immunization-types";
import type { Immunization } from "./resources";

/**
 * A patient's immunization history — a core mobile-clinic concern (vaccination
 * drives are much of what mobile units do). Returns administered doses, newest
 * first; grouping doses of the same vaccine happens in the UI.
 */

function toRecord(immunization: Immunization): ImmunizationRecord {
  const coding = immunization.vaccineCode?.coding?.[0];
  return {
    id: immunization.id ?? "",
    vaccineName:
      immunization.vaccineCode?.text ?? coding?.display ?? coding?.code ?? "Unknown vaccine",
    cvxCode: coding?.code,
    date: immunization.occurrenceDateTime?.slice(0, 10),
    status: immunization.status ?? "unknown",
  };
}

export async function getImmunizations(patientId: string): Promise<ImmunizationRecord[]> {
  const resources = await fhirClient.search<Immunization>("Immunization", {
    patient: patientId,
    _count: 200,
  });

  return resources
    .map(toRecord)
    // Only doses actually given — drop errors and not-done entries.
    .filter((record) => record.status === "completed")
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
