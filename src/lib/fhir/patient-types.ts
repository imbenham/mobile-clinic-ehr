/**
 * Client-safe patient constants and view models.
 *
 * These are shared between server code (FHIR access in `patients.ts`) and
 * client components (the form, search). Keep this module free of `server-only`
 * imports and any Node/FHIR-server access so it can ship to the browser.
 */

import type { Patient } from "./resources";

/**
 * The FHIR administrative-gender value set. We need the values at runtime (form
 * options, Zod enum), which the FHIR types can't provide — `Patient["gender"]`
 * is an inline union with no runtime representation. So the tuple is the source
 * of truth, but `satisfies` pins it to the FHIR definition: an invalid value
 * won't compile. (`satisfies` won't catch a *missing* value, but the R4 set is
 * stable.) The `import type` is erased, so this module stays client-safe.
 */
export const GENDER_VALUES = ["male", "female", "other", "unknown"] as const satisfies readonly NonNullable<Patient["gender"]>[];
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
