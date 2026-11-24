/**
 * Vermont county, read off a Census county-subdivision GEOID.
 *
 * A county-subdivision GEOID is ten digits: the two-digit state FIPS (50 for
 * Vermont), the three-digit county FIPS, then the five-digit subdivision. The
 * county sits in the middle, so it comes straight out of the source identifier
 * a town already carries — it is not a name we invent or a mapping we guess.
 *
 * The FIPS-to-name table is Census reference data (the fourteen county FIPS
 * codes are fixed by the Bureau and cannot drift). We keep every county so an
 * unknown code reads as null and surfaces rather than silently attaching a town
 * to the wrong corner of the state.
 */

export const VT_STATE_FIPS = '50';

/** Census FIPS code (3 digits) -> official county name, all fourteen counties. */
export const VT_COUNTIES: Readonly<Record<string, string>> = {
  '001': 'Addison',
  '003': 'Bennington',
  '005': 'Caledonia',
  '007': 'Chittenden',
  '009': 'Essex',
  '011': 'Franklin',
  '013': 'Grand Isle',
  '015': 'Lamoille',
  '017': 'Orange',
  '019': 'Orleans',
  '021': 'Rutland',
  '023': 'Washington',
  '025': 'Windham',
  '027': 'Windsor',
};

/** The county a county-subdivision GEOID sits in, or null when it is not a Vermont town geoid. */
export function countyFromGeoid(geoid: string): string | null {
  if (!/^\d{10}$/.test(geoid)) return null;
  if (geoid.slice(0, 2) !== VT_STATE_FIPS) return null;
  const fips = geoid.slice(2, 5);
  return VT_COUNTIES[fips] ?? null;
}
