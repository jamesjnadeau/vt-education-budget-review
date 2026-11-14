/**
 * The state's grade-band count for a budget entity, added up from AOE's
 * town-of-residence publication (request #851, `aoe-adm-subgroups`).
 *
 * This is the `aoe` fallback the model form's prefill uses where a district's
 * own budget gives no band figure. See
 * docs/superpowers/specs/2026-10-22-aoe-town-sum-prefill-design.md.
 *
 * Only exact sums are produced. A band is a number only when every
 * contributing town cell is published, or the town has no resident students
 * (an exact 0). If any contributing cell is withheld, the band is reported as
 * withheld and carries no value, no bound and no count of hidden towns: a
 * withheld cell's bound is never used to fill, narrow or suggest a value.
 * (`sumBands` in adm-lookup.ts skips nulls and so yields partial sums; it must
 * not be used here.)
 */

import {
  resolveAdm,
  STATUTORY_BANDS,
  type BandValues,
  type ResolvedAdm,
  type StatutoryBand,
} from '@vt-budget/model';

import type { PublishedCell, SubgroupPublication } from './aoe/adm-subgroups/publish.ts';
import type { RegistryEntity } from './registry/types.ts';

export interface TownYearSum {
  readonly preliminary: boolean;
  /** Exact sums. null where the band is withheld or not usable. */
  readonly values: BandValues;
  /** Bands with a withheld contributing cell, in statutory order. */
  readonly withheld: StatutoryBand[];
}

/**
 * The towns whose residents make up an entity: an SU's towns (excluding
 * reporting-only buckets, the same set the SU page uses), a UD's member towns,
 * or a town that runs its own school. Anything else has none.
 */
export function townsFor(entity: string, registry: ReadonlyMap<string, RegistryEntity>): string[] {
  const self = registry.get(entity);
  if (!self) return [];
  if (self.type === 'su') {
    return [...registry.values()]
      .filter((e) => e.type === 'town' && e.supervisory_union === entity && !e.reporting_only)
      .map((e) => e.slug)
      .sort();
  }
  if (self.type === 'ud') return [...self.member_towns].sort();
  if (self.type === 'town' && !self.operated_by && !self.reporting_only) return [entity];
  return [];
}

type BandState = { kind: 'exact'; value: number } | { kind: 'withheld' } | { kind: 'not_usable' };

function addCell(state: BandState, cell: PublishedCell): BandState {
  if (state.kind === 'withheld') return state;
  if ('status' in cell && cell.status === 'suppressed') return { kind: 'withheld' };
  if (state.kind === 'not_usable') return state;
  if ('value' in cell) return { kind: 'exact', value: state.value + cell.value };
  return { kind: 'not_usable' };
}

/** Exact band sums per fiscal year for an entity. Empty when the entity has no towns. */
export function townBandSums(
  entity: string,
  publication: SubgroupPublication,
  registry: ReadonlyMap<string, RegistryEntity>,
): Map<number, TownYearSum> {
  const out = new Map<number, TownYearSum>();
  const towns = townsFor(entity, registry);
  if (towns.length === 0) return out;

  for (const year of publication.years) {
    const states = Object.fromEntries(
      STATUTORY_BANDS.map((b) => [b, { kind: 'exact', value: 0 } as BandState]),
    ) as Record<StatutoryBand, BandState>;

    for (const town of towns) {
      const row = publication.towns[town]?.[year.school_year];
      if (!row) {
        // The publication derives not_applicable for every registry town it
        // lacks, so a missing row means the registry and publication disagree.
        throw new Error(
          `${entity}: town ${town} has no ${year.school_year} row in the town-of-residence publication`,
        );
      }
      if (row.row === 'not_applicable') continue; // an exact 0
      for (const band of STATUTORY_BANDS) {
        states[band] =
          row.row === 'below_reporting_floor'
            ? { kind: 'withheld' }
            : addCell(states[band], row.bands[band]);
      }
    }

    const values = {} as Record<StatutoryBand, number | null>;
    const withheld: StatutoryBand[] = [];
    for (const band of STATUTORY_BANDS) {
      const s = states[band];
      values[band] = s.kind === 'exact' ? Number(s.value.toFixed(2)) : null;
      if (s.kind === 'withheld') withheld.push(band);
    }
    out.set(year.fiscal_year, { preliminary: year.preliminary, values, withheld });
  }
  return out;
}

export interface PrefillBudget {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly adm?: BandValues | null;
}

/**
 * The model form's prefill rows: district figures first, then the exact town
 * sums, per entity and fiscal year. Entities are those with a budget record;
 * years are the union of the entity's budget years and the publication's
 * years, so the earlier slot of a two-year average has a row even without a
 * budget for it.
 *
 * Not for the homestead comparison, which stays on district figures so that no
 * state-derived count reaches the published rate comparison.
 */
export function buildPrefillAdm(
  budgets: ReadonlyArray<PrefillBudget>,
  publication: SubgroupPublication | null,
  registry: ReadonlyMap<string, RegistryEntity>,
): Record<string, Record<string, ResolvedAdm>> {
  const byEntity = new Map<string, Map<number, BandValues | null>>();
  for (const b of budgets) {
    const years = byEntity.get(b.entity) ?? new Map<number, BandValues | null>();
    years.set(b.fiscal_year, b.adm ?? null);
    byEntity.set(b.entity, years);
  }

  const out: Record<string, Record<string, ResolvedAdm>> = {};
  for (const [entity, districtByYear] of [...byEntity].sort(([a], [b]) => a.localeCompare(b))) {
    const sums = publication ? townBandSums(entity, publication, registry) : new Map<number, TownYearSum>();
    const years = [...new Set([...districtByYear.keys(), ...sums.keys()])].sort((a, b) => a - b);
    for (const fy of years) {
      const district = districtByYear.get(fy) ?? null;
      const sum = sums.get(fy);
      if (!district && !sum) continue;
      (out[entity] ??= {})[String(fy)] = resolveAdm(district, sum?.values ?? null, {
        withheld: sum?.withheld ?? [],
        preliminary: sum?.preliminary ?? false,
      });
    }
  }
  return out;
}
