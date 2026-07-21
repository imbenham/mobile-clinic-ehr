"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, inputClasses } from "@/components/ui/Field";
import { GENDER_VALUES, type PatientFormData } from "@/lib/fhir/patient-types";
import type { PatientFormState } from "@/app/patients/actions";
import { formatDate, titleCase } from "@/lib/utils/format";

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
  const duplicates =
    state.status === "needs_confirmation" ? state.duplicates ?? [] : [];

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/* Originals for the update duplicate-check gate: skip the check when the
          identifying fields are unchanged. Harmless (absent) on create. */}
      {defaultValues && (
        <>
          <input type="hidden" name="origFirstName" value={defaultValues.firstName ?? ""} />
          <input type="hidden" name="origLastName" value={defaultValues.lastName ?? ""} />
          <input type="hidden" name="origBirthDate" value={defaultValues.birthDate ?? ""} />
        </>
      )}

      {state.formError && (
        <div
          className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300"
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

      {duplicates.length > 0 && (
        <div className="rounded-md border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-4" role="alert">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Possible existing {duplicates.length === 1 ? "record" : "records"}
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            This patient may already be in the system. Please check before creating a
            duplicate.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {duplicates.map((match) => (
              <li
                key={match.id}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 dark:border-amber-800/50 bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{match.fullName}</p>
                  <p className="text-xs text-muted">
                    {titleCase(match.gender)} · {formatDate(match.birthDate)} · {match.reason}
                  </p>
                </div>
                <Link
                  href={`/patients/${match.id}`}
                  target="_blank"
                  className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-border px-3 text-sm font-medium text-primary transition hover:bg-background"
                >
                  Open ↗
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        {duplicates.length > 0 ? (
          <button
            type="submit"
            name="confirmDuplicate"
            value="yes"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Not a duplicate — continue"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
        )}
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
