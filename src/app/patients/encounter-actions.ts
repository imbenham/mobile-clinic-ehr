"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveEncounterVitals, type VitalReading } from "@/lib/fhir/encounter-vitals";
import { createEncounter, finishEncounter } from "@/lib/fhir/encounters";

/**
 * Start a new encounter for a patient and jump into it. Bound with the patient
 * id and used as a `<form action>`.
 */
export async function createEncounterAction(patientId: string): Promise<void> {
  const encounter = await createEncounter(patientId);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/encounters`);
  redirect(`/patients/${patientId}/encounters/${encounter.id}`);
}

/** Close an in-progress encounter; the detail page re-renders as finished. */
export async function finishEncounterAction(
  patientId: string,
  encounterId: string,
): Promise<void> {
  await finishEncounter(encounterId);
  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  revalidatePath(`/patients/${patientId}/encounters`);
}

/**
 * Auto-save vitals recorded during an encounter (upsert). Called by the entry
 * panel as the clinician edits and on the way out — no explicit save.
 *
 * Deliberately does NOT revalidate: this fires repeatedly during data entry, and
 * a route refresh on each save would re-fetch the whole chart mid-typing. The
 * pages are `force-dynamic`, so the next visit reflects the new readings anyway.
 */
export async function saveEncounterVitalsAction(
  patientId: string,
  encounterId: string,
  readings: VitalReading[],
): Promise<void> {
  await saveEncounterVitals(patientId, encounterId, readings);
}
