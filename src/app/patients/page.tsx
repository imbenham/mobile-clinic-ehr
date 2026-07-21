import { PatientRail } from "@/components/patients/PatientRail";
import { FhirError } from "@/lib/fhir/client";
import { listPatients, type PatientView } from "@/lib/fhir/patients";

export const dynamic = "force-dynamic";

/**
 * Patients index.
 *
 * Portrait: the full-width roster (the rail in list form), which navigates to a
 * detail route on tap. Landscape: a placeholder in the detail pane — the roster
 * already lives in the persistent rail from the layout, so this side just
 * prompts a selection and hosts the "New patient" action.
 */
export default async function PatientsPage() {
  let patients: PatientView[] = [];
  let error: string | null = null;
  try {
    patients = await listPatients();
  } catch (err) {
    error = err instanceof FhirError ? err.message : "Could not load patients.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="text-sm text-muted">All patients on the FHIR server</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : (
        <>
          {/* Portrait: the roster itself. */}
          <div className="lg:hidden">
            <PatientRail initialPatients={patients} />
          </div>

          {/* Landscape: the rail is in the layout, so prompt a selection here. */}
          <div className="hidden min-h-[60vh] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center lg:flex">
            <div className="text-muted">
              <p className="text-3xl" aria-hidden>
                ✚
              </p>
              <p className="mt-3 text-sm">
                Select a patient from the list to view their record.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
