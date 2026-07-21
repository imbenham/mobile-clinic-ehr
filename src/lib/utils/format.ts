/** Small presentation helpers shared across pages. */

/** Format an ISO date (YYYY-MM-DD) as e.g. "12 Mar 1985". Returns "—" if empty. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Whole-year age from an ISO birth date. Returns null if unparseable. */
export function ageFromBirthDate(iso: string | undefined): number | null {
  if (!iso) return null;
  const birth = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Format an ISO datetime as e.g. "18 Jul 2026, 14:30". Returns "—" if empty. */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Coarse "how long ago" for a timestamp, e.g. "14 months ago".
 *
 * Deliberately vague at the long end — the point is to let a clinician judge
 * whether something is stale, not to imply precision the data doesn't have.
 * Returns null for missing, unparseable, or future timestamps.
 */
export function relativeFromNow(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;

  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365.25);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * "Last, First Middle" — the roster/list convention. `firstName` already holds
 * the joined given names (first + middle). Degrades gracefully if either part
 * is missing.
 */
export function formatLastNameFirst(firstName: string, lastName: string): string {
  const last = lastName.trim();
  const first = firstName.trim();
  if (last && first) return `${last}, ${first}`;
  return last || first || "Unknown";
}

/** Capitalize the first letter (for gender display, etc.). */
export function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
