
export const VitalsComponentNames: Record<string, string> = {
  '29463-7': 'Weight',
  '8302-2': 'Height',
  '39156-5': 'BMI',
  '85354-9': 'Blood Pressure',
  '8867-4': 'Heart Rate',
  '9279-1': 'Respiratory Rate',
  '8310-5': 'Temperature',
  '2708-6': 'Oxygen Saturation',
  '59408-5': 'Oxygen Saturation',
  '72514-3': 'Pain Score',
  '8462-4': 'Diastolic',
  '8480-6': 'Systolic'
};

/** Per-vital presentation config, keyed by the display name above. */
export interface VitalDisplayConfig {
  /** Sort order of the widget in the grid. */
  order: number;
  /** Preferred unit label (falls back to the observation's own unit). */
  unit?: string;
  /** Decimal places for the displayed value. */
  precision: number;
  /** Chart line colour. */
  color: string;
  /** Normal reference range [low, high] used to tint the latest reading. */
  normal?: [number, number];
}

export const VITAL_DISPLAY: Record<string, VitalDisplayConfig> = {
  'Blood Pressure':    { order: 1, unit: 'mmHg', precision: 0, color: '#0d6ea8' },
  'Heart Rate':        { order: 2, unit: 'bpm',  precision: 0, color: '#dc2626', normal: [60, 100] },
  'Respiratory Rate':  { order: 3, unit: '/min', precision: 0, color: '#0891b2', normal: [12, 20] },
  'Temperature':       { order: 4, unit: '°C',   precision: 1, color: '#ea580c', normal: [36.1, 37.2] },
  'Oxygen Saturation': { order: 5, unit: '%',    precision: 0, color: '#7c3aed', normal: [95, 100] },
  'Weight':            { order: 6, unit: 'kg',   precision: 1, color: '#059669' },
  'Height':            { order: 7, unit: 'cm',   precision: 0, color: '#65a30d' },
  'BMI':               { order: 8,               precision: 1, color: '#c026d3', normal: [18.5, 24.9] },
  'Pain Score':        { order: 9, unit: '/10',  precision: 0, color: '#e11d48', normal: [0, 3] },
};

/**
 * Vitals that can be recorded during an encounter — the single-value ones, each
 * a single `valueQuantity`. Blood pressure is intentionally excluded for now: it
 * is a panel with systolic/diastolic components and needs a different shape.
 * `ucum` is the UCUM unit code written to `valueQuantity.code`.
 */
export interface WritableVital {
  key: string;
  label: string;
  loinc: string;
  unit: string;
  ucum: string;
  step: string;
  /** Computed, not typed — read-only in the UI (e.g. BMI from height & weight). */
  derived?: boolean;
}

export const WRITABLE_VITALS: WritableVital[] = [
  { key: "heartRate", label: "Heart rate", loinc: "8867-4", unit: "bpm", ucum: "/min", step: "1" },
  { key: "respiratoryRate", label: "Respiratory rate", loinc: "9279-1", unit: "/min", ucum: "/min", step: "1" },
  { key: "temperature", label: "Temperature", loinc: "8310-5", unit: "°C", ucum: "Cel", step: "0.1" },
  { key: "oxygenSaturation", label: "O₂ saturation", loinc: "59408-5", unit: "%", ucum: "%", step: "1" },
  { key: "painScore", label: "Pain score", loinc: "72514-3", unit: "/10", ucum: "{score}", step: "1" },
  { key: "weight", label: "Weight", loinc: "29463-7", unit: "kg", ucum: "kg", step: "0.1" },
  { key: "height", label: "Height", loinc: "8302-2", unit: "cm", ucum: "cm", step: "1" },
  { key: "bmi", label: "BMI", loinc: "39156-5", unit: "kg/m²", ucum: "kg/m2", step: "0.1", derived: true },
];

/**
 * Blood pressure is a panel Observation with systolic/diastolic components, not
 * a single value — so it has its own config and dual inputs rather than living
 * in WRITABLE_VITALS.
 */
export const BP_VITAL = {
  name: "Blood Pressure",
  loinc: "85354-9",
  unit: "mmHg",
  ucum: "mm[Hg]",
  step: "1",
  systolic: { key: "bpSystolic", loinc: "8480-6", display: "Systolic blood pressure" },
  diastolic: { key: "bpDiastolic", loinc: "8462-4", display: "Diastolic blood pressure" },
} as const;

export interface VitalsComponent {
  codeSystem: string;
  code: string;
  name: string; // prefer coding.display over code.text
  value: number;
  unit?: string;
}

export interface VitalsEntry extends VitalsComponent {
  observationId: string;
  takenAt: string; // prefer effectiveDateTime over issued
  encounterId?: string;
  components?: VitalsComponent[];
}

