"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Debounced name search. Pushes the query into the URL (`?q=`) so the
 * server component re-fetches the filtered patient list. Keeping search state
 * in the URL makes results shareable and back-button friendly.
 */
export function PatientSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  useEffect(() => {
    // Don't re-navigate on mount if nothing changed.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      router.replace(`/patients?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search patients by name"
        className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
