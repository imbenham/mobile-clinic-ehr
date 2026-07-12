/**
 * Barrel of FHIR R4 resource and data types.
 *
 * `@types/fhir` exposes every R4 type (Patient, Observation, Bundle, Quantity,
 * CodeableConcept, …) as a named export of the `fhir/r4` module — as well as
 * via the `fhir4` UMD global. Re-exporting them here lets the rest of the app
 * use clean, explicit named imports instead of the global namespace:
 *
 *   import { Patient, Observation, Bundle } from "@/lib/fhir/resources";
 *
 * This is a type-only re-export, so it erases completely at compile time and is
 * safe to import from client components.
 */
export type * from "fhir/r4";
