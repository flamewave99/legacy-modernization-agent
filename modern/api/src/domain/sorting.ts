// Sort orders the legacy model applies in Java [SPEC §5.2].
// Owner.getPets and Vet.getSpecialties use String.CASE_INSENSITIVE_ORDER, Pet.getVisits sorts by
// date descending, and the vets query orders by last_name, first_name.

/**
 * Java's String.CASE_INSENSITIVE_ORDER: compare code point by code point after mapping each through
 * Character.toUpperCase then Character.toLowerCase, then by length in UTF-16 code units. This is not
 * quite the same as comparing lowercased strings (dotless `ı` uppercases to `I`, so it equals `i`), and
 * it is not `localeCompare` (`é` sorts after `z`).
 */
export function compareCaseInsensitive(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i) ?? 0;
    const cb = b.codePointAt(j) ?? 0;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
    if (ca === cb) continue;
    const ua = toUpper(ca);
    const ub = toUpper(cb);
    if (ua === ub) continue;
    const la = toLower(ua);
    const lb = toLower(ub);
    if (la !== lb) return la - lb;
  }
  return a.length - i - (b.length - j);
}

// Character.toUpperCase(int) is a one-to-one mapping; JS maps strings and can expand (`ß` to `SS`).
// Keep the code point when the JS mapping is not a single code point.
function toUpper(cp: number): number {
  return single(String.fromCodePoint(cp).toUpperCase()) ?? cp;
}

function toLower(cp: number): number {
  return single(String.fromCodePoint(cp).toLowerCase()) ?? cp;
}

function single(s: string): number | undefined {
  const cp = s.codePointAt(0);
  return cp !== undefined && String.fromCodePoint(cp).length === s.length ? cp : undefined;
}

/** Plain code-unit order, like Java's String.compareTo. */
function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function sortPetsByName<T extends { name: string }>(pets: readonly T[]): T[] {
  return [...pets].sort((a, b) => compareCaseInsensitive(a.name, b.name));
}

/**
 * Date descending; dates are `yyyy-MM-dd`, so string order is date order. Legacy throws on a NULL
 * date (D1); modern never saves one, but sorts any old NULL rows last instead of failing.
 */
export function sortVisitsByDateDesc<T extends { date: string | null }>(visits: readonly T[]): T[] {
  return [...visits].sort((a, b) => {
    if (a.date === b.date) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return compareCodeUnits(b.date, a.date);
  });
}

export function sortVets<T extends { lastName: string; firstName: string }>(
  vets: readonly T[],
): T[] {
  return [...vets].sort(
    (a, b) =>
      compareCodeUnits(a.lastName, b.lastName) || compareCodeUnits(a.firstName, b.firstName),
  );
}

export function sortSpecialtiesByName<T extends { name: string }>(specialties: readonly T[]): T[] {
  return [...specialties].sort((a, b) => compareCaseInsensitive(a.name, b.name));
}
