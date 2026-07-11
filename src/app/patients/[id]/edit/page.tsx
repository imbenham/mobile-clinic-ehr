import Link from "next/link";
import { notFound } from "next/navigation";

import { updatePatientAction } from "@/app/patients/actions";
import { PatientForm } from "@/components/patients/PatientForm";
import { FhirError } from "@/lib/fhir/client";
import { getPatientView } from "@/lib/fhir/patients";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let patient;
  try {
    patient = await getPatientView(id);
  } catch (err) {
    if (err instanceof FhirError && err.status === 404) notFound();
    throw err;
  }

  // Bind the patient id into the update action. A bound Server Action is still
  // a Server Action reference, so it can be passed to the client form.
  const action = updatePatientAction.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={`/patients/${id}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to patient
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit {patient.fullName}
        </h1>
        <p className="text-sm text-muted">Update details and save back to FHIR.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <PatientForm
          action={action}
          defaultValues={{
            firstName: patient.firstName,
            lastName: patient.lastName,
            gender: patient.gender,
            birthDate: patient.birthDate,
          }}
          submitLabel="Save changes"
          cancelHref={`/patients/${id}`}
        />
      </div>
    </div>
  );
}
