import "server-only";

import { ensureClinicLocation, getClinicLocationId } from "./clinic";
import { fhirClient } from "./client";
import type { EncounterView } from "./encounter-types";
import { getPatientView } from "./patients";
import type { Encounter } from "./resources";

/**
 * Encounters at our mobile clinic.
 *
 * An encounter is a visit: created "in-progress" so vitals can be charted
 * against it, then "finished" to close it. Everything here is scoped to our
 * clinic's Location — a Synthea patient carries dozens of encounters from other
 * providers that aren't ours to show.
 */

function toEncounterView(encounter: Encounter): EncounterView {
  return {
    id: encounter.id ?? "",
    patientId: encounter.subject?.reference?.replace("Patient/", "") ?? "",
    status: encounter.status ?? "unknown",
    start: encounter.period?.start,
    end: encounter.period?.end,
    typeText: encounter.type?.[0]?.text ?? encounter.type?.[0]?.coding?.[0]?.display,
    locationName: encounter.location?.[0]?.location?.display,
  };
}

/** Start a new in-progress encounter for this patient at our clinic. */
export async function createEncounter(patientId: string): Promise<EncounterView> {
  const [clinic, patient] = await Promise.all([
    ensureClinicLocation(),
    getPatientView(patientId).catch(() => null),
  ]);

  const created = await fhirClient.create<Encounter>("Encounter", {
    resourceType: "Encounter",
    status: "in-progress",
    // "field" — care delivered in the field, apt for a mobile unit.
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "FLD", display: "field" },
    type: [{ text: "Mobile clinic visit" }],
    subject: { reference: `Patient/${patientId}`, display: patient?.fullName },
    period: { start: new Date().toISOString() },
    location: [
      {
        location: { reference: `Location/${clinic.id}`, display: clinic.name },
        status: "active",
      },
    ],
  });

  return toEncounterView(created);
}

/** Read a single encounter for display. */
export async function getEncounter(encounterId: string): Promise<EncounterView> {
  return toEncounterView(await fhirClient.read<Encounter>("Encounter", encounterId));
}

/** Close an in-progress encounter: status → finished, stamp the end time. */
export async function finishEncounter(encounterId: string): Promise<EncounterView> {
  const encounter = await fhirClient.read<Encounter>("Encounter", encounterId);
  encounter.status = "finished";
  encounter.period = { ...(encounter.period ?? {}), end: new Date().toISOString() };
  return toEncounterView(await fhirClient.update<Encounter>("Encounter", encounter));
}

/** All of this patient's encounters at our clinic, newest first. */
export async function listClinicEncounters(patientId: string): Promise<EncounterView[]> {
  const clinicId = await getClinicLocationId();
  if (!clinicId) return [];

  const encounters = await fhirClient.search<Encounter>("Encounter", {
    patient: patientId,
    location: clinicId,
    _sort: "-date",
    _count: 100,
  });
  return encounters.map(toEncounterView);
}

/** Count of this patient's encounters at our clinic (cheap; no bodies fetched). */
export async function countClinicEncounters(patientId: string): Promise<number> {
  const clinicId = await getClinicLocationId();
  if (!clinicId) return 0;
  return fhirClient.count("Encounter", { patient: patientId, location: clinicId });
}
