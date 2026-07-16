import "server-only";

import type {
  CarePlanActivity,
  CarePlanDetail,
  CarePlanListItem,
  CareTeamMember,
  MonitoringFact,
} from "./care-plan-types";
import { fhirClient } from "./client";
import { getConditionsByIds } from "./conditions";
import { listMedications } from "./medications";
import type {
  CarePlan,
  CareTeam,
  CodeableConcept,
  Observation,
  Organization,
  Practitioner,
} from "./resources";

export async function listCarePlans(patientId: string): Promise<CarePlanListItem[]> {
  const resources = await fhirClient.search<CarePlan>("CarePlan", {
    patient: patientId,
    "status:not": ["entered-in-error", "revoked"],
    _count: 200,
  });

  return resources.map(carePlanToListItem);
}

/**
 * A care plan plus everything a clinician needs to act on it in the field:
 * what it addresses, who else is managing it, what's been prescribed for it,
 * and when the things it monitors were last measured.
 *
 * The supporting lookups are best-effort — a failure to resolve the care team
 * shouldn't take down the page, so each degrades to empty rather than throwing.
 */
export async function getCarePlanDetail(carePlanId: string): Promise<CarePlanDetail> {
  const resource = await fhirClient.read<CarePlan>("CarePlan", carePlanId);
  const base = carePlanToListItem(resource);

  const [conditions, careTeam, medications, monitoring] = await Promise.all([
    orEmpty(getConditionsByIds(base.conditionIds)),
    orEmpty(resolveCareTeam(resource)),
    orEmpty(relatedMedications(base.patientId, base.conditionIds)),
    orEmpty(latestMonitoring(base.patientId, base.categoryCode)),
  ]);

  return {
    ...base,
    endDate: resource.period?.end,
    activities: (resource.activity ?? []).flatMap(toActivity),
    conditions,
    careTeam,
    medications,
    monitoring,
  };
}

const orEmpty = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);

// SNOMED semantic tags stripped from displayed labels, e.g. "(record artifact)".
// Enumerated rather than stripping any trailing parenthetical, which would
// mangle legitimate ones such as "Cholesterol (mass/volume)".
const SNOMED_TAG =
  /\s*\((record artifact|finding|disorder|situation|procedure|regime\/therapy|observable entity|occupation|qualifier value)\)\s*$/i;

const stripTag = (label: string): string => label.replace(SNOMED_TAG, "").trim();

/**
 * CarePlans usually carry a generic US Core category ("assess-plan", no
 * display) alongside a descriptive SNOMED one ("Diabetes self management plan").
 * Pick the first category that actually has a human-readable label.
 */
const planCategory = (carePlan: CarePlan): { label?: string; code?: string } => {
  for (const category of carePlan.category ?? []) {
    const coding = category.coding?.find((c) => c.display);
    const label = category.text ?? coding?.display;
    if (label) return { label: stripTag(label) || undefined, code: coding?.code };
  }
  return {};
};

const carePlanToListItem = (carePlan: CarePlan): CarePlanListItem => {
  const { label: category, code: categoryCode } = planCategory(carePlan);
  const title = carePlan.title || carePlan.description || category || "Untitled care plan";
  const status = carePlan.status || "unknown";
  const conditionIds = (carePlan.addresses ?? []).flatMap((address) =>
    address.reference?.startsWith("Condition/")
      ? [address.reference.replace("Condition/", "")]
      : [],
  );
  const startDate = carePlan.period?.start || carePlan.created;

  return {
    carePlanId: carePlan.id ?? "",
    patientId: carePlan.subject?.reference?.replace("Patient/", "") ?? "",
    title,
    status,
    category,
    categoryCode,
    conditionIds,
    startDate,
  };
};

const conceptText = (concept?: CodeableConcept): string | undefined => {
  const raw = concept?.text ?? concept?.coding?.find((c) => c.display)?.display;
  return raw ? stripTag(raw) || undefined : undefined;
};

const toActivity = (activity: NonNullable<CarePlan["activity"]>[number]): CarePlanActivity[] => {
  const name = conceptText(activity.detail?.code);
  if (!name) return [];
  return [{ name, status: activity.detail?.status, location: activity.detail?.location?.display }];
};

/* -------------------------------------------------------------------------- */
/*  Care team                                                                  */
/* -------------------------------------------------------------------------- */

const humanName = (practitioner: Practitioner): string | undefined => {
  const name = practitioner.name?.[0];
  if (!name) return undefined;
  if (name.text) return name.text;
  return [...(name.prefix ?? []), ...(name.given ?? []), name.family]
    .filter(Boolean)
    .join(" ")
    .trim();
};

const contactPoint = (
  telecom: Practitioner["telecom"] | Organization["telecom"],
  system: "email" | "phone",
): string | undefined => telecom?.find((t) => t.system === system)?.value;

const formatAddress = (
  address: Practitioner["address"] | Organization["address"],
): string | undefined => {
  const first = address?.[0];
  if (!first) return undefined;
  return [...(first.line ?? []), first.city, first.state, first.postalCode]
    .filter(Boolean)
    .join(", ");
};

/**
 * Flatten the plan's CareTeams into contactable members.
 *
 * The patient is always listed as a participant; they're dropped here since
 * this section exists to answer "who else do I coordinate with".
 */
async function resolveCareTeam(carePlan: CarePlan): Promise<CareTeamMember[]> {
  const teamIds = (carePlan.careTeam ?? []).flatMap((ref) =>
    ref.reference?.startsWith("CareTeam/") ? [ref.reference.replace("CareTeam/", "")] : [],
  );
  if (teamIds.length === 0) return [];

  // One search per team that pulls the team AND its participant resources in a
  // single round trip (this server returns _include'd resources in full — their
  // telecom/address are intact, not summarised). The bundle comes back
  // flattened as [CareTeam, Practitioner, Organization, …]; keep every entry,
  // not just the first, or the whole point of the _include is lost.
  const perTeam = await Promise.all(
    teamIds.map((id) =>
      fhirClient
        .search<CareTeam | Practitioner | Organization>("CareTeam", {
          _id: id,
          _include: ["CareTeam:participant:Practitioner", "CareTeam:participant:Organization"],
        })
        .catch(() => []),
    ),
  );

  const teams: CareTeam[] = [];
  const practitioners: Practitioner[] = [];
  const organizations: Organization[] = [];

  for (const resource of perTeam.flat()) {
    if (resource.resourceType === "CareTeam") {
      teams.push(resource);
    } else if (resource.resourceType === "Practitioner") {
      practitioners.push(resource);
    } else if (resource.resourceType === "Organization") {
      organizations.push(resource);
    }
  }

  const members = new Map<string, CareTeamMember>();

  for (const team of teams) {
    for (const participant of team?.participant ?? []) {
      const reference = participant.member?.reference;
      if (!reference) continue;

      const [resourceType, id] = reference.split("/");
      if (resourceType !== "Practitioner" && resourceType !== "Organization") continue;
      if (members.has(reference)) continue;

      const kind = resourceType === "Practitioner" ? "practitioner" : "organization";
      const role = conceptText(participant.role?.[0]);
      const member: CareTeamMember = {
        id,
        name: participant.member?.display ?? reference,
        role,
        kind,
      };

      // Contact details only live on the referenced resource, not the reference.
      if (kind === "practitioner") {
        const practitioner = practitioners.find((p) => p.id === id);
        if (practitioner) {
          member.name = humanName(practitioner) ?? member.name;
          member.email = contactPoint(practitioner.telecom, "email");
          member.phone = contactPoint(practitioner.telecom, "phone");
          member.address = formatAddress(practitioner.address);
        }
      } else {
        const organization = organizations.find((o) => o.id === id);
        if (organization) {
          member.name = organization.name ?? member.name;
          member.email = contactPoint(organization.telecom, "email");
          member.phone = contactPoint(organization.telecom, "phone");
          member.address = formatAddress(organization.address);
        }
      }

      members.set(reference, member);
    }
  }

  // Practitioners first — a person to call outranks a building.
  return [...members.values()].sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === "practitioner" ? -1 : 1,
  );
}

/* -------------------------------------------------------------------------- */
/*  Related medications                                                        */
/* -------------------------------------------------------------------------- */

async function relatedMedications(patientId: string, conditionIds: string[]) {
  if (!patientId || conditionIds.length === 0) return [];
  const addressed = new Set(conditionIds);
  const medications = await listMedications(patientId);
  return medications.filter((m) => m.reasonConditionIds.some((id) => addressed.has(id)));
}

/* -------------------------------------------------------------------------- */
/*  Monitoring                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What each kind of care plan is measured by, keyed by the plan's SNOMED
 * category code.
 *
 * This maps a plan to the observations *relevant* to it — it deliberately says
 * nothing about how often they're due, since that's a clinical recommendation
 * we're not in a position to make. The UI shows the last value and how long ago
 * it was taken, and leaves the judgement to the clinician.
 */
const PLAN_MONITORING: Record<string, Array<{ label: string; loinc: string }>> = {
  // Diabetes self management plan
  "735985000": [
    { label: "HbA1c", loinc: "4548-4" },
    { label: "Blood glucose", loinc: "2339-0" },
    { label: "Blood pressure", loinc: "85354-9" },
    { label: "BMI", loinc: "39156-5" },
  ],
  // Hyperlipidemia clinical management plan
  "736285004": [
    { label: "Total cholesterol", loinc: "2093-3" },
    { label: "LDL cholesterol", loinc: "18262-6" },
    { label: "HDL cholesterol", loinc: "2085-9" },
    { label: "Triglycerides", loinc: "2571-8" },
  ],
  // Weight management program
  "718361005": [
    { label: "Weight", loinc: "29463-7" },
    { label: "BMI", loinc: "39156-5" },
  ],
};

const SYSTOLIC = "8480-6";
const DIASTOLIC = "8462-4";

const cleanUnit = (unit?: string): string => (unit === "mm[Hg]" ? "mmHg" : unit ?? "");

const trim = (value: number): string => Number(value.toFixed(2)).toString();

const formatValue = (observation: Observation): string | undefined => {
  const quantity = observation.valueQuantity;
  if (quantity?.value !== undefined) {
    return `${trim(quantity.value)} ${cleanUnit(quantity.unit)}`.trim();
  }

  // Panels such as blood pressure carry no top-level value — the readings live
  // in the components.
  const components = observation.component ?? [];
  const component = (loinc: string) =>
    components.find((c) => c.code?.coding?.some((cd) => cd.code === loinc))?.valueQuantity;

  const systolic = component(SYSTOLIC);
  const diastolic = component(DIASTOLIC);
  if (systolic?.value !== undefined && diastolic?.value !== undefined) {
    return `${trim(systolic.value)}/${trim(diastolic.value)} ${cleanUnit(systolic.unit)}`.trim();
  }

  return observation.valueString ?? conceptText(observation.valueCodeableConcept);
};

/** Latest reading of each thing this plan's category implies we watch. */
async function latestMonitoring(
  patientId: string,
  categoryCode: string | undefined,
): Promise<MonitoringFact[]> {
  const watched = categoryCode ? PLAN_MONITORING[categoryCode] : undefined;
  if (!patientId || !watched) return [];

  return Promise.all(
    watched.map(async ({ label, loinc }) => {
      const [observation] = await fhirClient
        .search<Observation>("Observation", {
          patient: patientId,
          code: `http://loinc.org|${loinc}`,
          _sort: "-date",
          _count: 1,
        })
        .catch(() => []);

      if (!observation) return { label };
      return {
        label,
        value: formatValue(observation),
        date: observation.effectiveDateTime ?? observation.effectivePeriod?.start,
      };
    }),
  );
}
