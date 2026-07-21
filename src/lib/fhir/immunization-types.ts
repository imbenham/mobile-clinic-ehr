/** Client-safe immunization view model. One record per administered dose. */

export interface ImmunizationRecord {
  id: string;
  /** Vaccine label, e.g. "Influenza, split virus, trivalent, PF". */
  vaccineName: string;
  /** CVX code — used to group doses of the same vaccine. */
  cvxCode?: string;
  /** ISO date (YYYY-MM-DD) administered. */
  date?: string;
  status: string;
}
