import type { CarePlanListItem } from "./care-plan-types";
import { fhirClient } from "./client";
import { CarePlan } from "./resources";


export async function listCarePlans(patientId: string): Promise<CarePlanListItem[]> {
  const resources = await fhirClient.search<CarePlan>("CarePlan", {
    patient: patientId,
    "status:not": ["entered-in-error", "revoked"],
    _count: 200,
  });

  return resources.map(carePlanToListItem);
}

/** Fetch a single care plan (for the detail page). */
export async function getCarePlan(carePlanId: string): Promise<CarePlanListItem> {
  const resource = await fhirClient.read<CarePlan>("CarePlan", carePlanId);
  return carePlanToListItem(resource);
}

// SNOMED semantic tags stripped from category labels, e.g. "(record artifact)".
const SNOMED_TAG =
  /\s*\((record artifact|finding|disorder|situation|procedure|regime\/therapy)\)\s*$/i;

/**
 * CarePlans usually carry a generic US Core category ("assess-plan", no
 * display) alongside a descriptive SNOMED one ("Diabetes self management plan").
 * Pick the first category that actually has a human-readable label.
 */
const planCategoryLabel = (carePlan: CarePlan): string | undefined => {
  const label = carePlan.category
    ?.map((c) => c.text ?? c.coding?.find((cd) => cd.display)?.display)
    .find((v): v is string => Boolean(v));
  return label?.replace(SNOMED_TAG, "").trim() || undefined;
};

const carePlanToListItem = (carePlan: CarePlan): CarePlanListItem => {
  const category = planCategoryLabel(carePlan);
  const title = carePlan.title || carePlan.description || category || "Untitled care plan";
  const status = carePlan.status || "unknown";
  const conditionIds = (carePlan.addresses ?? []).filter(address => address.reference?.startsWith('Condition')).flatMap(address => address.reference ? [address.reference.replace("Condition/", "")] : []);
  const startDate = carePlan.period?.start || carePlan.created;

  return {
    carePlanId: carePlan.id ?? "",
    patientId: carePlan.subject?.reference?.replace("Patient/", "") ?? "",
    title,
    status,
    category,
    conditionIds,
    startDate,
  };
};
