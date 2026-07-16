/** Client-safe care plan view models. */

import type { ConditionView } from "./condition-types";
import type { MedicationHistoryEntry } from "./medication-types";

export interface CarePlanListItem {
  carePlanId: string;
  patientId: string;
  title: string;
  status: string;
  conditionIds: string[];
  category?: string;
  /** SNOMED code behind `category` — used to look up what the plan monitors. */
  categoryCode?: string;
  startDate?: string; // prefer period.start, but fallback to created if missing
}

/** A planned intervention, e.g. "Diabetic diet" — from CarePlan.activity. */
export interface CarePlanActivity {
  name: string;
  status?: string;
  /** Where the activity is carried out — a fixed site, which matters in the field. */
  location?: string;
}

/** A practitioner or organization on the plan's care team, with how to reach them. */
export interface CareTeamMember {
  id: string;
  name: string;
  role?: string;
  kind: "practitioner" | "organization";
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * The latest reading of something this plan monitors — a plain fact, no
 * judgement about whether it's due. See PLAN_MONITORING in care-plan.ts.
 */
export interface MonitoringFact {
  label: string;
  /** Formatted value + unit, e.g. "5.88 %" or "128/83 mm[Hg]". Absent if never recorded. */
  value?: string;
  /** When it was recorded (ISO). */
  date?: string;
}

export interface CarePlanDetail extends CarePlanListItem {
  endDate?: string;
  /** The conditions this plan addresses, resolved to names. */
  conditions: ConditionView[];
  activities: CarePlanActivity[];
  careTeam: CareTeamMember[];
  /** Medications prescribed against the addressed conditions. */
  medications: MedicationHistoryEntry[];
  monitoring: MonitoringFact[];
}
