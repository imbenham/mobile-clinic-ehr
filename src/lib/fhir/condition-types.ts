/** Client-safe condition view model + classification helpers. */

export interface ConditionView {
  id: string;
  /** Condition/diagnosis name (SNOMED semantic tags stripped). */
  name: string;
  /** SNOMED (or other) code from the first coding — used for classification. */
  code?: string;
  /** 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved'. */
  clinicalStatus?: string;
  /** 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' … */
  verificationStatus?: string;
  onset?: string;
  abatement?: string;
  recordedDate?: string;
}

/** Clinical statuses we treat as "current" (shown by default). */
const ACTIVE_STATUSES = new Set(["active", "recurrence", "relapse"]);

/** A condition is current unless it's explicitly resolved/inactive/remission. */
export function isActiveCondition(condition: ConditionView): boolean {
  // Default unknown/missing status to active — safer to surface than to bury.
  return !condition.clinicalStatus || ACTIVE_STATUSES.has(condition.clinicalStatus);
}

/**
 * Social-determinant / lifestyle SNOMED codes (as emitted by Synthea's SDOH
 * modules). These are legitimate FHIR Conditions but they're context, not a
 * diagnosis, so we split them out of the primary problem list.
 *
 * This is deliberately code-driven rather than tag-driven: many clinically
 * important items (Prediabetes, obesity, History of MI) share the `(finding)`
 * or `(situation)` SNOMED tag with social items, so classifying by tag would
 * wrongly bury them.
 */
const SOCIAL_SNOMED_CODES = new Set([
  "160903007", // Full-time employment
  "160904001", // Part-time employment
  "224362002", // Employment (occupation)
  "73438004", // Unemployed
  "741062008", // Not in labor force
  "224299000", // Received higher education
  "105531004", // Housing unsatisfactory
  "423315002", // Limited social contact
  "422650009", // Social isolation
  "160968000", // Risk activity involvement
  "706893006", // Victim of intimate partner abuse
  "266948004", // Has a criminal record
  "424393004", // Reports of violence in the environment
  "424858003", // Threats of violence in the environment
  "406133002", // High community crime rate
  "713142003", // At risk for violence (finding)
]);

/** Conservative keyword backstop for social findings not in the code set. */
const SOCIAL_KEYWORDS =
  /\b(employment|unemployed|labou?r force|higher education|social isolation|limited social|risk activity|housing|intimate partner)\b/i;

/** True when a condition is a social/lifestyle context rather than a diagnosis. */
export function isSocialCondition(condition: ConditionView): boolean {
  if (condition.code && SOCIAL_SNOMED_CODES.has(condition.code)) return true;
  return SOCIAL_KEYWORDS.test(condition.name);
}
