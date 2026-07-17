import { PatientWorkspace } from "@/components/patients/PatientWorkspace";
import type { PatientView } from "@/lib/fhir/patient-types";
import { listPatients } from "@/lib/fhir/patients";

export const dynamic = "force-dynamic";

/**
 * Split-view shell for the patients area, tuned for a tablet in the field.
 *
 * On wide (landscape) screens the roster is a persistent left rail beside the
 * detail pane, so a clinician keeps the patient list in view and can jump
 * between records without losing their place. Because this is a layout, the rail
 * is fetched once and survives navigation between patients — only the pane
 * swaps. On narrow (portrait) screens the rail is hidden here and the index
 * route renders the roster full-width instead (plain list ↔ detail navigation).
 */
export default async function PatientsLayout({ children }: { children: React.ReactNode }) {
  let patients: PatientView[] = [];
  try {
    patients = await listPatients();
  } catch {
    // A rail failure shouldn't blank the whole area; the pane still renders and
    // the index route surfaces its own error.
  }

  return <PatientWorkspace patients={patients}>{children}</PatientWorkspace>;
}
