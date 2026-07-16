export interface MedicationHistoryEntry {
  medicationRequestId: string;
  medicationDescription: string;
  status: string;
  dateWritten: string;
  dateEnded?: string;
  prescriberName?: string;
  detectedIssue?: string;
  /** Condition ids from `reasonReference` — what this drug was prescribed for. */
  reasonConditionIds: string[];
}