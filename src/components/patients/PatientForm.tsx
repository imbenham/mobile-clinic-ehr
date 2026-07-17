"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, inputClasses } from "@/components/ui/Field";
import { GENDER_VALUES, type PatientFormData } from "@/lib/fhir/patient-types";
import type { PatientFormState } from "@/app/patients/actions";
import { titleCase } from "@/lib/utils/format";

type Action = (
  prev: PatientFormState,
  formData: FormData,
) => Promise<PatientFormState>;

/**
 * Shared create/edit patient form.
 *
 * Uses a Server Action (passed in as `action`) with `useActionState` so the
 * authoritative validation runs on the server, but we also set HTML-level
 * constraints (required, max on date) for instant browser feedback.
 */
export function PatientForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref,
}: {
  action: Action;
  defaultValues?: Partial<PatientFormData>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    action,
    { status: "idle" },
  );

  // On re-render after a validation error, prefer the values the user submitted.
  const values = state.values ?? defaultValues ?? {};
  const errors = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.formError && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.formError}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName} required>
          <input
            id="firstName"
            name="firstName"
            type="text"
            defaultValue={values.firstName ?? ""}
            aria-invalid={!!errors.firstName}
            className={inputClasses}
            autoComplete="off"
          />
        </Field>

        <Field label="Last name" htmlFor="lastName" error={errors.lastName} required>
          <input
            id="lastName"
            name="lastName"
            type="text"
            defaultValue={values.lastName ?? ""}
            aria-invalid={!!errors.lastName}
            className={inputClasses}
            autoComplete="off"
          />
        </Field>

        <Field label="Gender" htmlFor="gender" error={errors.gender} required>
          <select
            id="gender"
            name="gender"
            defaultValue={values.gender ?? ""}
            aria-invalid={!!errors.gender}
            className={inputClasses}
          >
            <option value="" disabled>
              Select…
            </option>
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {titleCase(g)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Date of birth"
          htmlFor="birthDate"
          error={errors.birthDate}
          required
        >
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            max={today}
            defaultValue={values.birthDate ?? ""}
            aria-invalid={!!errors.birthDate}
            className={inputClasses}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center rounded-md px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
