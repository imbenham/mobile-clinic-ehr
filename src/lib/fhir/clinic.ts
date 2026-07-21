import "server-only";

import { fhirClient } from "./client";
import type { Location } from "./resources";

/**
 * Stand-in for the "logged-in clinic" until there's real auth.
 *
 * This prototype has no authentication, so we fake the notion of "the mobile
 * clinic whose system the user logged into" with a single hardcoded Location,
 * identified by a stable business identifier so find-or-create is idempotent.
 */
export const CLINIC = {
  identifierSystem: "urn:mc-ehr:clinic",
  identifierValue: "mobile-unit-1",
  name: "MC Mobile Unit 1",
} as const;

const CLINIC_IDENTIFIER = `${CLINIC.identifierSystem}|${CLINIC.identifierValue}`;

/**
 * Find the clinic Location's id, or null if it hasn't been provisioned yet.
 * Read-only — used by chart/list views so they never write as a side effect of
 * rendering. (No clinic yet simply means zero encounters here.)
 */
export async function getClinicLocationId(): Promise<string | null> {
  const results = await fhirClient.search<Location>("Location", { identifier: CLINIC_IDENTIFIER });
  return results[0]?.id ?? null;
}

// Provision runs at most once per server process — memoised, and cleared on
// failure so a transient error doesn't poison every later call.
let ensurePromise: Promise<Location> | null = null;

/**
 * The clinic Location, creating it on first use if the server doesn't have it.
 * Only the encounter-creation path calls this, so writes never happen on a plain
 * read.
 */
export function ensureClinicLocation(): Promise<Location> {
  ensurePromise ??= provisionClinic().catch((err) => {
    ensurePromise = null;
    throw err;
  });
  return ensurePromise;
}

async function provisionClinic(): Promise<Location> {
  const existing = await fhirClient.search<Location>("Location", { identifier: CLINIC_IDENTIFIER });
  if (existing[0]) return existing[0];

  return fhirClient.create<Location>("Location", {
    resourceType: "Location",
    status: "active",
    mode: "instance",
    name: CLINIC.name,
    identifier: [{ system: CLINIC.identifierSystem, value: CLINIC.identifierValue }],
    physicalType: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
          code: "ve",
          display: "Vehicle",
        },
      ],
    },
  });
}
