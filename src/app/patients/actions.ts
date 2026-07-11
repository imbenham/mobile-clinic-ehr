"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { FhirError } from "@/lib/fhir/client";
import { createPatient, updatePatient } from "@/lib/fhir/patients";
import {
  flattenPatientErrors,
  patientSchema,
  type PatientFieldErrors,
} from "@/lib/validation/patient";

/**
 * Result returned to the form via useActionState.
 * On validation failure we return field errors and the submitted values so the
 * form can re-render without losing the user's input.
 */
export interface PatientFormState {
  status: "idle" | "error";
  fieldErrors?: PatientFieldErrors;
  formError?: string;
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

export async function createPatientAction(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const raw = parseForm(formData);
  const parsed = patientSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenPatientErrors(parsed.error), values: raw };
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
