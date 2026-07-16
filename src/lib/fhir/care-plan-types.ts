export interface CarePlanListItem {
  carePlanId: string;
  patientId: string;
  title: string;
  status: string;
  conditionIds: string[];
  category?: string;
  startDate?: string; // prefer period.start, but fallback to created if missing
}