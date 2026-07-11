import Link from "next/link";

import { PatientSearch } from "@/components/patients/PatientSearch";
import { FhirError } from "@/lib/fhir/client";
import { listPatients, type PatientView } from "@/lib/fhir/patients";
import { ageFromBirthDate, formatDate, titleCase } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let patients: PatientView[] = [];
  let error: string | null = null;
  try {
    patients = await listPatients(q);
  } catch (err) {
    error = err instanceof FhirError ? err.message : "Could not load patients.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-muted">
            {q ? `Results for “${q}”` : "All patients on the FHIR server"}
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-1.5 self-start rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:self-auto"
        >
          <span aria-hidden>＋</span> New patient
        </Link>
      </div>

      <PatientSearch />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : patients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center text-muted">
          {q ? "No patients match your search." : "No patients found."}
        </div>
      ) : (
        <PatientTable patients={patients} />
      )}
    </div>
  );
}

function PatientTable({ patients }: { patients: PatientView[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Gender</th>
            <th className="px-4 py-3 font-medium">Date of birth</th>
            <th className="px-4 py-3 font-medium">Age</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => {
            const age = ageFromBirthDate(p.birthDate);
            return (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 transition hover:bg-background"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3">{titleCase(p.gender)}</td>
                <td className="px-4 py-3">{formatDate(p.birthDate)}</td>
                <td className="px-4 py-3 text-muted">{age ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/patients/${p.id}/edit`}
                    className="text-xs font-medium text-muted hover:text-foreground"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
