import "server-only";

import { fhirClient } from "./client";
import type { Observation } from "./resources";
import { BP_VITAL, WRITABLE_VITALS } from "./vitals-types";

/**
 * Vitals recorded against a specific encounter.
 *
 * One Observation per vital per encounter: saving is an upsert keyed on
 * (encounter, LOINC code), so auto-save can fire repeatedly without piling up
 * duplicate readings. Blood pressure is a panel with systolic/diastolic
 * components; everything else is a single valueQuantity. The read side prefills
 * the entry inputs with whatever was recorded this visit.
 */

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const VITAL_SIGNS_CATEGORY = {
  coding: [
    {
      system: "http://terminology.hl7.org/CodeSystem/observation-category",
      code: "vital-signs",
      display: "Vital Signs",
    },
  ],
};

const loincOf = (obs: Observation): string | undefined =>
  obs.code?.coding?.find((c) => c.system === LOINC)?.code;

const componentValue = (obs: Observation, loinc: string): number | undefined =>
  obs.component?.find((c) => c.code?.coding?.some((cd) => cd.code === loinc))?.valueQuantity?.value;

/** Map of writable-vital key → recorded value (string) for this encounter. */
export async function getEncounterVitals(encounterId: string): Promise<Record<string, string>> {
  const observations = await fhirClient.search<Observation>("Observation", {
    encounter: encounterId,
    _count: 100,
  });

  const values: Record<string, string> = {};
  for (const obs of observations) {
    const code = loincOf(obs);

    if (code === BP_VITAL.loinc) {
      const sys = componentValue(obs, BP_VITAL.systolic.loinc);
      const dia = componentValue(obs, BP_VITAL.diastolic.loinc);
      if (sys != null) values[BP_VITAL.systolic.key] = String(sys);
      if (dia != null) values[BP_VITAL.diastolic.key] = String(dia);
      continue;
    }

    const vital = code && WRITABLE_VITALS.find((v) => v.loinc === code);
    if (vital && obs.valueQuantity?.value != null) {
      values[vital.key] = String(obs.valueQuantity.value);
    }
  }
  return values;
}

export interface SingleReading {
  key: string;
  value: number;
}
export interface BloodPressureReading {
  key: "bloodPressure";
  systolic: number;
  diastolic: number;
}
export type VitalReading = SingleReading | BloodPressureReading;

/** Upsert the given readings as Observations tied to this encounter. */
export async function saveEncounterVitals(
  patientId: string,
  encounterId: string,
  readings: VitalReading[],
): Promise<void> {
  if (readings.length === 0) return;

  const existing = await fhirClient.search<Observation>("Observation", {
    encounter: encounterId,
    _count: 100,
  });
  const byLoinc = new Map<string, Observation>();
  for (const obs of existing) {
    const code = loincOf(obs);
    if (code) byLoinc.set(code, obs);
  }

  const now = new Date().toISOString();
  const subject = { reference: `Patient/${patientId}` };
  const encounter = { reference: `Encounter/${encounterId}` };

  await Promise.all(
    readings.map(async (reading) => {
      if ("systolic" in reading) {
        const component = [
          bpComponent(BP_VITAL.systolic.loinc, BP_VITAL.systolic.display, reading.systolic),
          bpComponent(BP_VITAL.diastolic.loinc, BP_VITAL.diastolic.display, reading.diastolic),
        ];
        const current = byLoinc.get(BP_VITAL.loinc);
        if (current) {
          current.status = "final";
          current.component = component;
          current.effectiveDateTime = now;
          await fhirClient.update<Observation>("Observation", current);
        } else {
          await fhirClient.create<Observation>("Observation", {
            resourceType: "Observation",
            status: "final",
            category: [VITAL_SIGNS_CATEGORY],
            code: {
              coding: [{ system: LOINC, code: BP_VITAL.loinc, display: "Blood pressure panel" }],
              text: "Blood pressure",
            },
            subject,
            encounter,
            effectiveDateTime: now,
            component,
          });
        }
        return;
      }

      const vital = WRITABLE_VITALS.find((v) => v.key === reading.key);
      if (!vital || Number.isNaN(reading.value)) return;

      const quantity = { value: reading.value, unit: vital.unit, system: UCUM, code: vital.ucum };
      const current = byLoinc.get(vital.loinc);
      if (current) {
        current.status = "final";
        current.valueQuantity = quantity;
        current.effectiveDateTime = now;
        await fhirClient.update<Observation>("Observation", current);
      } else {
        await fhirClient.create<Observation>("Observation", {
          resourceType: "Observation",
          status: "final",
          category: [VITAL_SIGNS_CATEGORY],
          code: {
            coding: [{ system: LOINC, code: vital.loinc, display: vital.label }],
            text: vital.label,
          },
          subject,
          encounter,
          effectiveDateTime: now,
          valueQuantity: quantity,
        });
      }
    }),
  );
}

function bpComponent(loinc: string, display: string, value: number) {
  return {
    code: { coding: [{ system: LOINC, code: loinc, display }] },
    valueQuantity: { value, unit: BP_VITAL.unit, system: UCUM, code: BP_VITAL.ucum },
  };
}
