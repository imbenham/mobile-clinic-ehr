import "server-only";

import { jaroWinkler } from "@/lib/utils/similarity";

import { fhirClient } from "./client";
import type { DuplicateMatch, PatientFormData } from "./patient-types";
import { toPatientView } from "./patients";
import type { Patient } from "./resources";

/**
 * Duplicate-patient guard.
 *
 * Duplicate records are a chronic problem for mobile clinics — the same person
 * turns up at different sites and gets re-registered because the prior record
 * couldn't be found. This flags likely matches so the clinician can confirm
 * before creating (or renaming into) a collision.
 *
 * Date of birth is the anchor: two distinct people almost never share an exact
 * DOB *and* a similar surname, and a re-registration almost always gets the DOB
 * right even when the name is typed differently. So DOB does the precision work
 * and the (Jaro-Winkler) name comparison only has to be "good enough" on top of
 * it. Tuned for precision over recall — a roadblock that's often wrong just
 * trains staff to click through it.
 */

// Surname similarity that still counts as "the same surname" (typos, spelling
// variants) once the date of birth already matches exactly.
const SURNAME_STRONG = 0.85;
// Tighter bar used when the DOB is only a near-match, or for the first name.
const NAME_TIGHT = 0.9;

// Cap on how many candidates a single blocking key pulls back. Real same-DOB /
// same-surname pools are tiny; this is just a runaway guard.
const CANDIDATE_LIMIT = 50;

/** Lower-case, strip accents, collapse whitespace — so "José" ≈ "jose". */
function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * True when two ISO dates look like the same date mistyped: a single wrong
 * digit, or a day/month transposition (a classic date-entry slip).
 */
function dobNearMatch(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  const da = a.replace(/-/g, "");
  const db = b.replace(/-/g, "");
  if (da.length !== 8 || db.length !== 8) return false;

  let diff = 0;
  for (let i = 0; i < 8; i++) if (da[i] !== db[i]) diff++;
  if (diff === 1) return true;

  // Day/month swap within the same year, e.g. 1985-03-12 vs 1985-12-03.
  return a.slice(0, 4) === b.slice(0, 4) && a.slice(5, 7) === b.slice(8, 10) && a.slice(8, 10) === b.slice(5, 7);
}

/** The tiered rule. Returns a human-readable reason, or null if not a match. */
function duplicateReason(input: PatientFormData, candidate: Patient): string | null {
  const view = toPatientView(candidate);

  const inFirst = norm(input.firstName);
  const inLast = norm(input.lastName);
  const inDob = input.birthDate.trim();
  const cFirst = norm(view.firstName);
  const cLast = norm(view.lastName);
  const cDob = view.birthDate.trim();

  // Without a DOB on both sides there's no anchor; only an exact full-name
  // collision is worth surfacing, and even that weakly.
  if (!inDob || !cDob) {
    if (inFirst && inLast && inFirst === cFirst && inLast === cLast) return "Same name (no date of birth to compare)";
    return null;
  }

  const surname = jaroWinkler(inLast, cLast);

  // Tier 1 — exact DOB anchors a looser surname match (catches spelling
  // variants and nicknames, since the first name may differ entirely).
  if (inDob === cDob && surname >= SURNAME_STRONG) {
    if (inFirst === cFirst && inLast === cLast) return "Same name and date of birth";
    if (jaroWinkler(inFirst, cFirst) >= NAME_TIGHT) return "Same date of birth and a near-identical name";
    return "Same date of birth and a matching surname";
  }

  // Tier 2 — a near-identical whole name rescues a mistyped DOB.
  if (dobNearMatch(inDob, cDob) && surname >= NAME_TIGHT && jaroWinkler(inFirst, cFirst) >= NAME_TIGHT) {
    return "Near-identical name with a very similar date of birth";
  }

  return null;
}

// Strongest signals first, so the most convincing match leads the warning.
const REASON_RANK: Record<string, number> = {
  "Same name and date of birth": 0,
  "Same date of birth and a near-identical name": 1,
  "Same date of birth and a matching surname": 2,
  "Near-identical name with a very similar date of birth": 3,
  "Same name (no date of birth to compare)": 4,
};

/**
 * Find existing patients that may be duplicates of the submitted data.
 *
 * Candidates come from exact-match "blocking" queries (birthdate, family) so we
 * never scan the whole roster — this stays cheap on a real population. The
 * small unioned pool is then scored with the tiered rule above.
 */
export async function findDuplicateCandidates(
  data: PatientFormData,
  opts: { excludeId?: string } = {},
): Promise<DuplicateMatch[]> {
  const dob = data.birthDate.trim();
  const family = data.lastName.trim();
  if (!dob && !family) return [];

  const [byDob, byFamily] = await Promise.all([
    dob
      ? fhirClient
          .search<Patient>("Patient", { birthdate: dob, _count: CANDIDATE_LIMIT })
          .catch(() => [] as Patient[])
      : Promise.resolve([] as Patient[]),
    family
      ? fhirClient
          .search<Patient>("Patient", { family, _count: CANDIDATE_LIMIT })
          .catch(() => [] as Patient[])
      : Promise.resolve([] as Patient[]),
  ]);

  const candidates = new Map<string, Patient>();
  for (const patient of [...byDob, ...byFamily]) {
    if (patient.id && patient.id !== opts.excludeId) candidates.set(patient.id, patient);
  }

  const matches: DuplicateMatch[] = [];
  for (const candidate of candidates.values()) {
    const reason = duplicateReason(data, candidate);
    if (!reason) continue;
    const view = toPatientView(candidate);
    matches.push({
      id: view.id,
      fullName: view.fullName,
      gender: view.gender,
      birthDate: view.birthDate,
      reason,
    });
  }

  matches.sort((a, b) => (REASON_RANK[a.reason] ?? 9) - (REASON_RANK[b.reason] ?? 9));
  return matches;
}
