/**
 * Client-safe patient constants and view models.
 *
 * These are shared between server code (FHIR access in `patients.ts`) and
 * client components (the form, search). Keep this module free of `server-only`
 * imports and any Node/FHIR-server access so it can ship to the browser.
 */

export const GENDER_VALUES = ["male", "female", "other", "unknown"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

/** Flattened patient shape used throughout the UI. */
export interface PatientView {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: Gender;
  birthDate: string; // ISO date, YYYY-MM-DD
}

/** The subset of fields the create/edit form manages. */
export interface PatientFormData {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
}
