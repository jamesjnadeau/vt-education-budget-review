/**
 * Turns committed ADM transcriptions into the JSON the site reads.
 *
 * The district rollup happens HERE rather than in the warehouse, because it is
 * derived from the warehouse plus the registry and `.gitignore` states the rule:
 * nothing derived is committed, so the git history only ever shows source data
 * changing.
 *
 * Re-deriving it at build time also means the conservation invariant in
 * `aggregate` runs again on every build, against the current registry rather
 * than the one that happened to be checked out at import. A registry change that
 * would strand a town's pupils fails the build instead of quietly publishing a
 * smaller district.
 */

import type { RegistryEntity } from '../../registry/types.ts';
import { aggregate } from './aggregate.ts';
import { classifyTown } from './classify.ts';
import { buildGapRegister } from './gaps.ts';
import type { JoinedRow } from './join.ts';

interface AdmRecord {
  fiscal_year: number;
  count_year: string;
  bands_as_published: Array<{ header: string; statutory_band: string | null }>;
  maps_to_statutory_bands: boolean;
  grand_total: number;
  towns: Array<{
    entity: string;
    aoe_org_id: string;
    name_as_published: string;
    values: Array<number | null>;
  }>;
}

export interface AdmPublication {
  readonly generated: string;
  readonly years: ReadonlyArray<{
    readonly fiscal_year: number;
    readonly count_year: string;
    readonly bands: ReadonlyArray<string>;
    readonly maps_to_statutory_bands: boolean;
    readonly grand_total: number;
    readonly districts: ReadonlyArray<{
      readonly district: string;
      readonly values: ReadonlyArray<number | null>;
    }>;
    readonly exclusions: ReadonlyArray<{
      readonly slug: string;
      readonly total: number;
      readonly justification: string;
    }>;
    readonly statutory_bands: Record<
      string,
      {
        readonly prekindergarten: number | null;
        readonly kindergarten_through_5: number | null;
        readonly grades_6_through_8: number | null;
        readonly grades_9_through_12: number | null;
      }
    >;
  }>;
  readonly gaps: ReturnType<typeof buildGapRegister>;
}

const STATUTORY_BANDS = [
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
] as const;

/**
 * Map a district's published-band values onto the four statutory bands, summing
 * any published columns that share a statutory band and dropping columns that
 * map to null. Returns null for a band with no contributing column. Every value
 * is null when the year does not map, and the caller emits {} in that case.
 */
function toStatutoryBands(
  bands: Array<{ header: string; statutory_band: string | null }>,
  values: ReadonlyArray<number | null>,
): Record<(typeof STATUTORY_BANDS)[number], number | null> {
  const out = Object.fromEntries(STATUTORY_BANDS.map((b) => [b, null])) as Record<
    (typeof STATUTORY_BANDS)[number],
    number | null
  >;
  bands.forEach((band, col) => {
    const key = band.statutory_band as (typeof STATUTORY_BANDS)[number] | null;
    if (!key || !STATUTORY_BANDS.includes(key)) return;
    const v = values[col];
    if (v === null || v === undefined) return;
    out[key] = Number(((out[key] ?? 0) + v).toFixed(2));
  });
  return out;
}

export function buildAdmPublication(
  records: ReadonlyArray<unknown>,
  registry: ReadonlyMap<string, RegistryEntity>,
  generated: string,
): AdmPublication {
  const years = (records as AdmRecord[])
    .slice()
    .sort((a, b) => a.fiscal_year - b.fiscal_year)
    .map((record) => {
      const joined: JoinedRow[] = record.towns.map((t) => {
        const entity = registry.get(t.entity);
        if (!entity) {
          throw new Error(
            `ADM record for FY${record.fiscal_year} names "${t.entity}", which is not a ` +
              `registry entity. Run \`npm run registry:sync\` and re-run \`npm run adm:import\`.`,
          );
        }
        return {
          row: {
            aoe_org_id: t.aoe_org_id,
            name_as_published: t.name_as_published,
            values: t.values,
          },
          slug: t.entity,
          entity,
          // Re-classified from the current registry rather than read back from
          // the record's own town_class, so a town that has since changed hands
          // rolls up where it belongs now. The transcription is the source's
          // voice about pupils; where a town sits is the registry's.
          town_class: classifyTown(entity),
        };
      });

      const rollup = aggregate(joined, record.bands_as_published.length);

      const statutory_bands: Record<string, ReturnType<typeof toStatutoryBands>> = {};
      if (record.maps_to_statutory_bands) {
        for (const d of rollup.districts) {
          statutory_bands[d.district] = toStatutoryBands(record.bands_as_published, d.values);
        }
      }

      return {
        fiscal_year: record.fiscal_year,
        count_year: record.count_year,
        bands: record.bands_as_published.map((b) => b.header),
        maps_to_statutory_bands: record.maps_to_statutory_bands,
        grand_total: record.grand_total,
        districts: rollup.districts.map((d) => ({ district: d.district, values: d.values })),
        exclusions: rollup.exclusions.map((e) => ({
          slug: e.slug,
          total: e.total,
          justification: e.justification,
        })),
        statutory_bands,
      };
    });

  return {
    generated,
    years,
    gaps: buildGapRegister(
      years.map((y) => ({
        fiscal_year: y.fiscal_year,
        maps_to_statutory_bands: y.maps_to_statutory_bands,
      })),
    ),
  };
}
