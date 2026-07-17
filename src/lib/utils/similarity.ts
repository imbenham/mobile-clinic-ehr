/**
 * Jaro-Winkler string similarity — a 0..1 score well suited to short human
 * names. It rewards a shared prefix (Winkler's tweak) and tolerates typos and
 * transpositions, which is exactly the kind of variation that produces
 * duplicate patient records. Dependency-free.
 */

/** Jaro similarity (0 = no match, 1 = identical). */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  // Only characters within this window can be considered a match.
  const window = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aMatched = new Array<boolean>(la).fill(false);
  const bMatched = new Array<boolean>(lb).fill(false);

  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  // Count transpositions among the matched characters.
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / la + matches / lb + (matches - transpositions) / matches) / 3;
}

/**
 * Jaro-Winkler: boosts the score when the strings share a leading prefix (up to
 * 4 chars). `p` is the prefix weight (0.1 is the standard value).
 */
export function jaroWinkler(a: string, b: string, p = 0.1): number {
  const base = jaro(a, b);
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return base + prefix * p * (1 - base);
}
