"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { FhirError } from "@/lib/fhir/client";
import { findDuplicateCandidates } from "@/lib/fhir/duplicates";
import type { DuplicateMatch, PatientView } from "@/lib/fhir/patient-types";
import { createPatient, listPatients, updatePatient } from "@/lib/fhir/patients";
import {
  flattenPatientErrors,
  patientSchema,
  type PatientFieldErrors,
} from "@/lib/validation/patient";

/**
 * Name search for the patient rail.
 *
 * The rail lives in the shared patients layout, and Next.js layouts don't
 * receive `searchParams` (they don't re-render on query-string changes), so the
 * rail can't drive search through the URL the way the standalone list does.
 * This action lets the client rail run the same server-side FHIR `name=` query
 * on demand — keeping search on the server so it scales past a screenful of
 * patients, rather than shipping the whole roster to the client to filter.
 */
export async function searchPatients(query: string): Promise<PatientView[]> {
  try {
    return await listPatients(query);
  } catch {
    return [];
  }
}

/**
 * Result returned to the form via useActionState.
 * On validation failure we return field errors and the submitted values so the
 * form can re-render without losing the user's input.
 */
export interface PatientFormState {
  status: "idle" | "error" | "needs_confirmation";
  fieldErrors?: PatientFieldErrors;
  formError?: string;
  /** Possible existing records, set when status is "needs_confirmation". */
  duplicates?: DuplicateMatch[];
  values?: {
    firstName: string;
    lastName: string;
    gender: string;
    birthDate: string;
  };
}

function parseForm(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
  };
}

/**
 * True once the clinician has seen the duplicate warning and chosen to proceed
 * anyway — the override button submits this. Skips the duplicate check.
 */
function isConfirmed(formData: FormData): boolean {
  return formData.get("confirmDuplicate") === "yes";
}

export async function createPatientAction(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const raw = parseForm(formData);
  const parsed = patientSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenPatientErrors(parsed.error), values: raw };
  }

  if (!isConfirmed(formData)) {
    const duplicates = await findDuplicateCandidates(parsed.data);
    if (duplicates.length > 0) {
      return { status: "needs_confirmation", duplicates, values: raw };
    }
  }

  try {
    await createPatient(parsed.data);
  } catch (err) {
    return {
      status: "error",
      formError: err instanceof FhirError ? err.message : "Failed to create patient.",
      values: raw,
    };
  }

  revalidatePath("/patients");
  redirect("/patients");
}

export async function updatePatientAction(
  id: string,
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const raw = parseForm(formData);
  const parsed = patientSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenPatientErrors(parsed.error), values: raw };
  }

  // Only re-check for duplicates if the identifying fields actually changed —
  // editing an unrelated field (e.g. gender) shouldn't trigger a roadblock over
  // a coincidental same-DOB/surname patient.
  const identityChanged =
    raw.firstName !== formData.get("origFirstName") ||
    raw.lastName !== formData.get("origLastName") ||
    raw.birthDate !== formData.get("origBirthDate");

  if (!isConfirmed(formData) && identityChanged) {
    const duplicates = await findDuplicateCandidates(parsed.data, { excludeId: id });
    if (duplicates.length > 0) {
      return { status: "needs_confirmation", duplicates, values: raw };
    }
  }

  try {
    await updatePatient(id, parsed.data);
  } catch (err) {
    return {
      status: "error",
      formError: err instanceof FhirError ? err.message : "Failed to update patient.",
      values: raw,
    };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}`);
}
