export interface MedicationHistoryEntry {
  medicationRequestId: string;
  medicationDescription: string;
  status: string;
  dateWritten: string;
  dateEnded?: string;
  prescriberName?: string;
  detectedIssue?: string;
}