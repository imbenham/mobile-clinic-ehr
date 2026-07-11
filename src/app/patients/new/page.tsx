import Link from "next/link";

import { createPatientAction } from "@/app/patients/actions";
import { PatientForm } from "@/components/patients/PatientForm";

export default function NewPatientPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/patients" className="text-sm text-muted hover:text-foreground">
          ← Back to patients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New patient</h1>
        <p className="text-sm text-muted">Register a new patient on the FHIR server.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <PatientForm
          action={createPatientAction}
          submitLabel="Create patient"
          cancelHref="/patients"
        />
      </div>
    </div>
  );
}
