import "server-only";
import type { Patient } from "./resources";

import { fhirClient } from "./client";
import type { Gender, PatientFormData, PatientView } from "./patient-types";

/**
 * Server-side domain helpers for working with FHIR Patient resources.
 *
 * FHIR Patient resources are verbose and deeply nested. The rest of the app
 * works with a flattened `PatientView` model; the mappers here translate in
 * both directions so UI/form code never has to touch raw FHIR shapes.
 *
 * Shared constants and types live in `./patient-types` so client components
 * can import them without pulling in this server-only module.
 */
export type { Gender, PatientFormData, PatientView } from "./patient-types";

function humanName(patient: Patient): { first: string; last: string; full: string } {
  // Prefer an "official" name, otherwise the first available.
  const name =
    patient.name?.find((n) => n.use === "official") ?? patient.name?.[0];
  const first = name?.given?.join(" ") ?? "";
  const last = name?.family ?? "";
  const full = name?.text ?? ([first, last].filter(Boolean).join(" ") || "Unknown");
  return { first, last, full };
}

/** Map a FHIR Patient resource into the flat view model. */
export function toPatientView(patient: Patient): PatientView {
  const { first, last, full } = humanName(patient);
  return {
    id: patient.id ?? "",
    firstName: first,
    lastName: last,
    fullName: full,
    gender: (patient.gender as Gender) ?? "unknown",
    birthDate: patient.birthDate ?? "",
  };
}

/**
 * Build a FHIR Patient resource from form data.
 *
 * When `existing` is provided the resource is patched in place so we preserve
 * fields the form doesn't manage (identifiers, contact info, meta, etc.).
 */
export function toPatientResource(
  data: PatientFormData,
  existing?: Patient,
): Patient {
  const base: Patient = existing
    ? structuredClone(existing)
    : { resourceType: "Patient" };

  base.gender = data.gender;
  base.birthDate = data.birthDate;
  base.name = [
    {
      use: "official",
      family: data.lastName,
      given: data.firstName ? data.firstName.split(" ").filter(Boolean) : [],
      text: [data.firstName, data.lastName].filter(Boolean).join(" "),
    },
  ];

  return base;
}

// --- Data access ------------------------------------------------------------

/**
 * List patients, optionally filtered by name.
 * FHIR's `name` search parameter matches given OR family name.
 */
export async function listPatients(query?: string): Promise<PatientView[]> {
  const patients = await fhirClient.search<Patient>("Patient", {
    _count: 50,
    _sort: "family",
    name: query?.trim() || undefined,
  });
  return patients.map(toPatientView);
}

export async function getPatient(id: string): Promise<Patient> {
  return fhirClient.read<Patient>("Patient", id);
}

export async function getPatientView(id: string): Promise<PatientView> {
  return toPatientView(await getPatient(id));
}

export async function createPatient(data: PatientFormData): Promise<Patient> {
  return fhirClient.create("Patient", toPatientResource(data));
}

export async function updatePatient(
  id: string,
  data: PatientFormData,
): Promise<Patient> {
  const existing = await getPatient(id);
  return fhirClient.update("Patient", toPatientResource(data, existing));
}
