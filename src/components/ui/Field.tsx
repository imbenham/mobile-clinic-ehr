import type { ReactNode } from "react";

/** Labeled form field wrapper with inline error display. */
export function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClasses =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-red-500";
