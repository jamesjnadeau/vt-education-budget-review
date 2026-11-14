/**
 * The state's grade-band count for a budget entity, added up from AOE's
 * town-of-residence publication (request #851, `aoe-adm-subgroups`).
 *
 * This is the `aoe` fallback the model form's prefill uses where a district's
 * own budget gives no band figure. See
 * docs/superpowers/specs/2026-10-22-aoe-town-sum-prefill-design.md.
 *
 * Only exact sums fill a field. A band is a number only when every
 * contributing town cell is published, or the town has no resident students
 * (an exact 0). If any contributing cell is withheld, the band is withheld and
 * the field stays blank. Beside it the form shows the range the published
 * bounds allow, the same range the SU page already shows
 * (site/src/lib/residents.ts `sumCells`): each hidden cell adds only the bound
 * AOE's rules give it on its own, and a cell with no top leaves the range open
 * above. Where a town's cell is one of a hidden pair, the form says so: at
 * least one of the two has 1 to 10 students. Nothing here solves a bound or
 * narrows one from a total.
 * (`sumBands` in adm-lookup.ts skips nulls and so yields partial sums; it must
 * not be used here.)
 */

import {
  resolveAdm,
  type ResolvedBand,
  STATUTORY_BANDS,
  type BandValues,
  type ResolvedAdm,
  type StatutoryBand,
} from '@vt-budget/model';

import type { PublishedCell, SubgroupPublication } from './aoe/adm-subgroups/publish.ts';
import type { RegistryEntity } from './registry/types.ts';

/**
 * What the published bounds allow for a withheld band, in ADM. `low` is
 * exclusive when any hidden cell's floor is (a hidden cell holds at least one
 * pupil, which can be under one ADM). `high` is null when a hidden cell has no
 * top (a pair member) or no bound at all.
 */
export interface BandRange {
  readonly low: number;
  readonly low_exclusive: boolean;
  readonly high: number | null;
}

/**
 * A town whose cell in this band is hidden together with one other band.
 * Read from the published bounds alone: a published row with exactly two
 * cells bounded below and open above is the pair rule's output. At least one
 * of the two holds 1 to 10 students; the extract does not say which.
 */
export interface BandPair {
  readonly town: string;
  readonly with: StatutoryBand;
}

export interface TownYearSum {
  readonly preliminary: boolean;
  /** Exact sums. null where the band is withheld or not usable. */
  readonly values: BandValues;
  /** Bands with a withheld contributing cell, in statutory order. */
  readonly withheld: StatutoryBand[];
  /** The range for each withheld band, unless a contributing cell is not published. */
  readonly ranges: Partial<Record<StatutoryBand, BandRange>>;
  /** For each withheld band, the towns whose cell is one of a hidden pair. */
  readonly pairs: Partial<Record<StatutoryBand, BandPair[]>>;
}

/** A prefill band: the resolved band, plus its range when it is withheld. */
export type PrefillBand = ResolvedBand & { readonly range?: BandRange; readonly pairs?: BandPair[] };
export type PrefillAdm = Record<StatutoryBand, PrefillBand>;

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

type RangeState = { low: number; low_exclusive: boolean; high: number | null } | 'not_usable';

function addToRange(r: RangeState, cell: PublishedCell): RangeState {
  if (r === 'not_usable') return r;
  if ('value' in cell) return { ...r, low: r.low + cell.value, high: r.high === null ? null : r.high + cell.value };
  if (cell.status === 'not_published') return 'not_usable';
  if (cell.low === undefined) return { ...r, high: null }; // no bound at all
  return {
    low: r.low + cell.low,
    low_exclusive: r.low_exclusive || cell.exclusive_low === true,
    high: r.high === null || cell.high === null || cell.high === undefined ? null : r.high + cell.high,
  };
}

const isPairMember = (cell: PublishedCell): boolean =>
  'status' in cell && cell.status === 'suppressed' && cell.low !== undefined && cell.high === null;

const round2 = (n: number): number => Number(n.toFixed(2));

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
  const townName = (slug: string): string => registry.get(slug)?.name ?? slug;

  for (const year of publication.years) {
    const states = Object.fromEntries(
      STATUTORY_BANDS.map((b) => [b, { kind: 'exact', value: 0 } as BandState]),
    ) as Record<StatutoryBand, BandState>;
    const ranges = Object.fromEntries(
      STATUTORY_BANDS.map((b) => [b, { low: 0, low_exclusive: false, high: 0 } as RangeState]),
    ) as Record<StatutoryBand, RangeState>;
    const pairs: Partial<Record<StatutoryBand, BandPair[]>> = {};

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
      const paired = row.row === 'published' ? STATUTORY_BANDS.filter((b) => isPairMember(row.bands[b])) : [];
      if (paired.length === 2) {
        const [a, b] = paired as [StatutoryBand, StatutoryBand];
        (pairs[a] ??= []).push({ town: townName(town), with: b });
        (pairs[b] ??= []).push({ town: townName(town), with: a });
      }
      for (const band of STATUTORY_BANDS) {
        ranges[band] = addToRange(ranges[band], row.bands[band]);
        states[band] =
          row.row === 'below_reporting_floor'
            ? { kind: 'withheld' }
            : addCell(states[band], row.bands[band]);
      }
    }

    const values = {} as Record<StatutoryBand, number | null>;
    const withheld: StatutoryBand[] = [];
    const bandRanges: Partial<Record<StatutoryBand, BandRange>> = {};
    for (const band of STATUTORY_BANDS) {
      const s = states[band];
      values[band] = s.kind === 'exact' ? round2(s.value) : null;
      if (s.kind !== 'withheld') continue;
      withheld.push(band);
      const r = ranges[band];
      if (r !== 'not_usable') {
        bandRanges[band] = { low: round2(r.low), low_exclusive: r.low_exclusive, high: r.high === null ? null : round2(r.high) };
      }
    }
    out.set(year.fiscal_year, { preliminary: year.preliminary, values, withheld, ranges: bandRanges, pairs });
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
 * sums, per entity and fiscal year. Entities are those with a budget record,
 * plus `alsoEntities` (the districts AOE's EdSpend records list), which get
 * town sums only; years are the union of the entity's budget years and the publication's
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
  alsoEntities: ReadonlyArray<string> = [],
): Record<string, Record<string, PrefillAdm>> {
  const byEntity = new Map<string, Map<number, BandValues | null>>();
  for (const entity of alsoEntities) byEntity.set(entity, new Map());
  for (const b of budgets) {
    const years = byEntity.get(b.entity) ?? new Map<number, BandValues | null>();
    years.set(b.fiscal_year, b.adm ?? null);
    byEntity.set(b.entity, years);
  }

  const out: Record<string, Record<string, PrefillAdm>> = {};
  for (const [entity, districtByYear] of [...byEntity].sort(([a], [b]) => a.localeCompare(b))) {
    const sums = publication ? townBandSums(entity, publication, registry) : new Map<number, TownYearSum>();
    const years = [...new Set([...districtByYear.keys(), ...sums.keys()])].sort((a, b) => a - b);
    for (const fy of years) {
      const district = districtByYear.get(fy) ?? null;
      const sum = sums.get(fy);
      if (!district && !sum) continue;
      const resolved: ResolvedAdm = resolveAdm(district, sum?.values ?? null, {
        withheld: sum?.withheld ?? [],
        preliminary: sum?.preliminary ?? false,
      });
      const row = { ...resolved } as PrefillAdm;
      for (const band of STATUTORY_BANDS) {
        if (row[band].source !== 'withheld') continue;
        const range = sum?.ranges[band];
        const bandPairs = sum?.pairs[band];
        row[band] = { ...row[band], ...(range ? { range } : {}), ...(bandPairs ? { pairs: bandPairs } : {}) };
      }
      (out[entity] ??= {})[String(fy)] = row;
    }
  }
  return out;
}
