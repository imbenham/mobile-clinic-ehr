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

/** Capitalize the first letter (for gender display, etc.). */
export function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
