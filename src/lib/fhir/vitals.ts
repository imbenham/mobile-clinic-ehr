import type { Observation, ObservationComponent } from "./resources";
import { fhirClient } from "./client";
import { VitalsEntry, VitalsComponent, VitalsComponentNames } from "./vitals-types";

export async function getVitalsHistory(patientId?: string): Promise<Record<string, VitalsEntry[]>> {
  const allVitalsObservations = await fhirClient.search<Observation>("Observation", {
    patient: patientId,
    category: "vital-signs",
    _sort: "-date",
    _count: 200,
  });
  const vitalsHistory: Record<string, VitalsEntry[]> = {};
  allVitalsObservations.forEach((observation) => {
    const vitalsEntry = parseObservationToVitalsEntry(observation);
    if (vitalsEntry) {
      if (!vitalsHistory[vitalsEntry.name]) {
        vitalsHistory[vitalsEntry.name] = [];
      }
      vitalsHistory[vitalsEntry.name].push(vitalsEntry);
    }
  });
  return vitalsHistory;
}

const parseObservationToVitalsEntry = (observation: Observation): VitalsEntry | null => {
  const takenAt = observation.effectiveDateTime || observation.issued;
  if (!observation.id || (!takenAt)) {
    return null;
  }
  const code = observation.code?.coding?.[0]?.code || "";
  const codeSystem = observation.code?.coding?.[0]?.system || "";
  const name = VitalsComponentNames[code];
  if (!name) {
    console.warn(`Unknown vitals observation code: ${code}`);
    return null;
  }

  const components: VitalsComponent[] = observation.component?.flatMap((component) => {
    const code = component.code?.coding?.[0]?.code || "";
    const valueAndUnit = extractVitalsObservationValueAndUnit(component);
    const name = VitalsComponentNames[code];
    if (!name) {
      console.warn(`Unknown vitals observation code: ${code}`);
    }
    if (!name || !valueAndUnit) {
      return [];
    }

    return {
      code,
      codeSystem: component.code?.coding?.[0]?.system || "",
      name,
      value: valueAndUnit.value,
      unit: valueAndUnit.unit,
    };
  }) || [];

  // Panel observations such as blood pressure carry no top-level value — the
  // reading lives in the components. Fall back to a representative component
  // (systolic for BP) so the entry isn't dropped.
  const valueAndUnit =
    extractVitalsObservationValueAndUnit(observation) ??
    components.find((c) => c.name === "Systolic") ??
    components[0];
  if (!valueAndUnit) {
    return null;
  }

  return {
  observationId: observation.id,
  takenAt: takenAt,
  components,
  encounterId:  observation.encounter?.reference?.replace('Encounter/', ''),
  codeSystem,
  code,
  name,
  value: valueAndUnit.value,
  unit: valueAndUnit.unit,
};
};

const extractVitalsObservationValueAndUnit = (observation: Observation | ObservationComponent): { value: number; unit: string | undefined } | null => {
  if (observation.valueQuantity) {
    return {
      value: observation.valueQuantity.value || 0,
      unit: observation.valueQuantity.unit,
    };
  } else if (observation.valueInteger !== undefined) {
    return {
      value: observation.valueInteger,
      unit: undefined,
    };
  }
  return null;
};