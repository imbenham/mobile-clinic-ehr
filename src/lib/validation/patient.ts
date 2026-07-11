import { z } from "zod";

import { GENDER_VALUES } from "@/lib/fhir/patient-types";

/**
 * Validation schema for the patient create/edit form.
 *
 * Shared between the client (live form feedback) and the server action
 * (authoritative validation before writing to FHIR) so the rules can't drift.
 */

/** Today's date as YYYY-MM-DD, in the server/user's local timezone. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const patientSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name is too long"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name is too long"),
  gender: z.enum(GENDER_VALUES, {
    message: "Select a gender",
  }),
  birthDate: z
    .string()
    .min(1, "Date of birth is required")
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
    .refine((v) => v <= todayIso(), "Date of birth cannot be in the future"),
});

export type PatientInput = z.infer<typeof patientSchema>;

/** Flattened field errors keyed by field name, for rendering next to inputs. */
export type PatientFieldErrors = Partial<Record<keyof PatientInput, string>>;

export function flattenPatientErrors(
  error: z.ZodError<PatientInput>,
): PatientFieldErrors {
  const result: PatientFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof PatientInput | undefined;
    if (key && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
