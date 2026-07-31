/**
 * Census Gazetteer county subdivisions, parsed and joined to the town registry.
 *
 * This supplies the denominator of the sparse screen: square miles of LAND.
 * Land area, never total area -- Vermont has towns whose water area is a third
 * of their extent, and dividing by the larger figure understates their density
 * and pulls them into eligibility they should not have. The parser therefore
 * reads ALAND_SQMI and AWATER_SQMI separately and never adds them.
 *
 * THE JOIN IS THE HARD PART, and it is deliberately conservative.
 *
 * AOE and the Census Bureau name Vermont's municipalities differently, and the
 * disagreements are not all cosmetic:
 *
 *   cosmetic      "Isle La Motte town" against AOE's "ISLE LAMOTTE"
 *                 "Mount Holly town" against "MT HOLLY"
 *                 "Saint Albans city" against "ST ALBANS CITY"
 *                 "Avery's gore" against "AVERYS GORE"
 *
 *   substantive   Census "Warren's gore" against AOE's "WARRENS GRANT".
 *                 Different words. Vermont has both a Warren's Gore and a
 *                 Warner's Grant, so this is exactly the pair where a fuzzy
 *                 match would silently attach one unorganized place's area to
 *                 another's name.
 *
 *   structural    Census "Bennington town", "Bradford town" and "Barton town"
 *                 have no plain town record in the registry at all: AOE records
 *                 residency for those three through incorporated school
 *                 districts, so the registry holds `town/bennington-id` and
 *                 nothing else.
 *
 * Only the cosmetic class is normalized away. Everything else lands in
 * `unmatched` with the reason, because an unmatched name is either a place we do
 * not track or a slug bug, and only a person can tell which. A joiner that
 * guesses here produces a town-level land area that is confidently wrong, which
 * is worse than a gap the screen reports honestly.
 */

import { slugifyName } from '../registry/slugs.ts';
import type { RegistryEntity } from '../registry/types.ts';

export interface GazetteerRow {
  readonly usps: string;
  readonly geoid: string;
  readonly name: string;
  readonly landAreaSqMi: number;
  readonly waterAreaSqMi: number;
}

export class GazetteerParseError extends Error {}

const REQUIRED_COLUMNS = ['USPS', 'GEOID', 'NAME', 'ALAND_SQMI', 'AWATER_SQMI'] as const;

/**
 * Parses a Gazetteer county-subdivision file.
 *
 * The published files pad every field with trailing spaces, so each cell is
 * trimmed. Column POSITIONS are not assumed: the header is read and the indices
 * looked up, because a column inserted upstream would otherwise shift land area
 * into water area without anything failing.
 */
export function parseGazetteer(text: string): GazetteerRow[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new GazetteerParseError('The gazetteer file is empty.');

  const header = (lines[0] as string).split('\t').map((c) => c.trim());
  const index: Record<string, number> = {};
  for (const column of REQUIRED_COLUMNS) {
    const at = header.indexOf(column);
    if (at === -1) {
      throw new GazetteerParseError(
        `The gazetteer file has no ${column} column. Columns present: ${header.join(', ')}. ` +
          `Do not fall back to a positional read -- a shifted column would put water area ` +
          `where land area belongs and nothing would fail.`,
      );
    }
    index[column] = at;
  }

  const rows: GazetteerRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split('\t').map((c) => c.trim());
    const land = Number(cells[index['ALAND_SQMI'] as number]);
    const water = Number(cells[index['AWATER_SQMI'] as number]);
    const geoid = cells[index['GEOID'] as number] ?? '';
    if (!/^\d{10}$/.test(geoid)) {
      throw new GazetteerParseError(`"${geoid}" is not a 10-digit county subdivision GEOID.`);
    }
    if (!Number.isFinite(land) || !Number.isFinite(water)) {
      throw new GazetteerParseError(`Row ${geoid} has a non-numeric area.`);
    }
    rows.push({
      usps: cells[index['USPS'] as number] ?? '',
      geoid,
      name: cells[index['NAME'] as number] ?? '',
      landAreaSqMi: land,
      waterAreaSqMi: water,
    });
  }
  return rows;
}

const SUFFIX = /\s(town|city|village|gore|grant|CDP)$/i;

/**
 * Slug candidates for a Census subdivision name, most specific first.
 *
 * The suffix-bearing candidate comes first because Vermont has paired
 * municipalities -- Barre city and Barre town, Rutland city and Rutland town --
 * that are separate places with separate areas. Dropping the suffix first would
 * make the pair collide and give one of them the other's land area.
 */
export function slugCandidates(censusName: string): string[] {
  const base = censusName.replace(SUFFIX, '').trim();
  const suffix = censusName.slice(base.length).trim().toLowerCase();

  const spellings = new Set<string>([
    base,
    base.replace(/'/g, ''),
    base.replace(/\bLa Motte\b/i, 'LaMotte'),
    base.replace(/^Mount /i, 'Mt '),
    base.replace(/^Saint /i, 'St '),
  ]);

  const out: string[] = [];
  // With the suffix first, then without: "Barre city" before "Barre".
  if (suffix) for (const s of spellings) out.push(`town/${slugifyName(`${s} ${suffix}`)}`);
  for (const s of spellings) out.push(`town/${slugifyName(s)}`);
  return [...new Set(out)];
}

export interface JoinedTown {
  readonly entity: string | null;
  readonly geoid: string;
  readonly nameAsPublished: string;
  readonly landAreaSqMi: number;
  readonly waterAreaSqMi: number;
}

export interface JoinResult {
  readonly towns: readonly JoinedTown[];
  readonly unmatched: ReadonlyArray<{ geoid: string; name_as_published: string; reason: string }>;
  /** Registry towns no Census subdivision matched. Reported, never invented. */
  readonly registryTownsWithoutArea: readonly string[];
}

export function joinToRegistry(
  rows: readonly GazetteerRow[],
  registry: ReadonlyMap<string, RegistryEntity>,
): JoinResult {
  // Reporting buckets are not places. A town record named UNKNOWN is how AOE
  // records residency for pupils whose town is not established; it has no land.
  const available = new Set(
    [...registry.values()]
      .filter((e) => e.type === 'town' && !e.reporting_only)
      .map((e) => e.slug),
  );

  const towns: JoinedTown[] = [];
  const unmatched: Array<{ geoid: string; name_as_published: string; reason: string }> = [];
  const claimed = new Set<string>();

  for (const row of rows) {
    const hit = slugCandidates(row.name).find((slug) => available.has(slug) && !claimed.has(slug));
    if (hit) claimed.add(hit);
    else {
      unmatched.push({
        geoid: row.geoid,
        name_as_published: row.name,
        reason:
          `No registry town matches "${row.name}". Either the Bureau and AOE use different ` +
          `names for this place -- which is substantive at least once, Census "Warren's gore" ` +
          `against AOE "WARRENS GRANT" -- or AOE tracks it only through an incorporated school ` +
          `district, as it does for Bennington, Bradford and Barton. Resolve by hand; the ` +
          `density screen reports no figure for it until someone does.`,
      });
    }
    towns.push({
      entity: hit ?? null,
      geoid: row.geoid,
      nameAsPublished: row.name,
      landAreaSqMi: row.landAreaSqMi,
      waterAreaSqMi: row.waterAreaSqMi,
    });
  }

  return {
    towns,
    unmatched,
    registryTownsWithoutArea: [...available].filter((slug) => !claimed.has(slug)).sort(),
  };
}
