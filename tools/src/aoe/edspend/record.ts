/**
 * Builds one warehouse record per fiscal year from a parsed EdSpend tab.
 *
 * Two lists come out of each tab, because the tab answers two questions:
 *
 *   towns      every town row: its tax rates, its supervisory union, and the
 *              union districts the membership rows place it in.
 *   districts  every school district with pupils or spending that year -- a
 *              town that runs its own district, or a union district.
 *
 * IDs are joined to the registry on aoe_org_id. A town-operated district is
 * the town itself in the registry (there is no separate district record for
 * it), so a T-code district resolves to town/<slug>. A row whose ID matches
 * nothing is kept in unresolved_rows rather than dropped, so the record can
 * still be counted against the tab.
 *
 * Figures are transcribed as stated. Where a stated figure disagrees with
 * the others in its row, the disagreement is written to `discrepancies` and
 * nothing is corrected: a per-pupil figure that is not spending / pupils may
 * be AOE's error or may reflect an adjustment the released file does not
 * show, and this file cannot tell which.
 */

import type { RegistryEntity } from '../../registry/types.ts';
import { RATE_LABELS, type ParsedSheet, type Rate, type RawRow } from './parse.ts';

/** What the H column counts, by the name the rest of this repo uses. */
export const PUPIL_MEASURES = {
  EqPup: 'equalized_pupils',
  LTWADM: 'long_term_weighted_adm',
} as const;

export interface UnionLink {
  readonly entity: string | null;
  readonly aoe_org_id: string;
  readonly name_as_published: string;
  readonly source_row: number;
}

export interface TownRecord {
  readonly entity: string | null;
  readonly aoe_org_id: string;
  readonly name_as_published: string;
  readonly county: string;
  readonly su: string | null;
  readonly su_number: number;
  readonly homestead_rate: number | null;
  readonly nonhomestead_rate: number | null;
  /** Set only when a rate cell held text instead of a number. */
  readonly rates_as_published: string | null;
  readonly union_districts: ReadonlyArray<UnionLink>;
  readonly source_row: number;
}

export interface DistrictRecord {
  readonly entity: string | null;
  readonly aoe_org_id: string;
  readonly district_type: 'town' | 'union';
  readonly name_as_published: string;
  readonly county: string;
  readonly su: string | null;
  readonly su_number: number;
  readonly pupils: number;
  readonly education_spending: number;
  readonly spending_per_pupil: number;
  readonly source_row: number;
}

export type DiscrepancyKind =
  | 'per_pupil_not_spending_over_pupils'
  | 'spending_without_pupils'
  | 'pupils_without_spending';

export interface Discrepancy {
  readonly kind: DiscrepancyKind;
  readonly entity: string | null;
  readonly aoe_org_id: string;
  readonly source_row: number;
  readonly stated: Record<string, number>;
  readonly recomputed_spending_per_pupil: number | null;
  readonly note: string;
}

export interface YearRecord {
  readonly schema_version: '1.0';
  readonly source: string;
  readonly sheet: string;
  readonly fiscal_year: number;
  readonly pupil_measure: (typeof PUPIL_MEASURES)[keyof typeof PUPIL_MEASURES];
  readonly pupil_measure_as_published: keyof typeof PUPIL_MEASURES;
  readonly rates_status: (typeof RATE_LABELS)[keyof typeof RATE_LABELS];
  readonly rates_label_as_published: keyof typeof RATE_LABELS;
  readonly banner: ParsedSheet['banner'];
  readonly statewide_total: {
    readonly pupils: number;
    readonly education_spending: number;
    readonly spending_per_pupil: number;
    readonly source_row: number;
  };
  readonly towns: ReadonlyArray<TownRecord>;
  readonly districts: ReadonlyArray<DistrictRecord>;
  readonly discrepancies: ReadonlyArray<Discrepancy>;
  readonly unresolved_rows: ReadonlyArray<{
    readonly aoe_org_id: string;
    readonly name_as_published: string;
    readonly row_type: RawRow['row_type'];
    readonly source_row: number;
    readonly note: string;
  }>;
  readonly extracted_by: string;
  readonly extracted_date: string;
}

export interface BuildOptions {
  readonly source: string;
  readonly registry: ReadonlyMap<string, RegistryEntity>;
  readonly extracted_by: string;
  readonly extracted_date: string;
}

type Lookup = (id: string) => RegistryEntity | undefined;

function lookupFor(
  registry: ReadonlyMap<string, RegistryEntity>,
  types: ReadonlyArray<RegistryEntity['type']>,
): Lookup {
  const out = new Map<string, RegistryEntity>();
  for (const e of registry.values()) {
    if (!types.includes(e.type) || !e.aoe_org_id) continue;
    if (out.has(e.aoe_org_id)) {
      throw new Error(`two ${types.join('/')} records carry AOE ID ${e.aoe_org_id}`);
    }
    out.set(e.aoe_org_id, e);
  }
  return (id) => out.get(id);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rateValue(r: Rate): number | null {
  return r === 'NA' ? null : r;
}

/**
 * The per-pupil column is printed to the cent, so spending / pupils rounded to
 * the cent should match it exactly. A one-cent tolerance absorbs the case
 * where AOE rounded an intermediate figure first.
 */
export function discrepanciesFor(row: RawRow, entity: string | null): Discrepancy[] {
  const base = { entity, aoe_org_id: row.gov_id, source_row: row.source_row };
  const stated = {
    pupils: row.pupils,
    education_spending: row.education_spending,
    spending_per_pupil: row.spending_per_pupil,
  };
  if (row.pupils === 0 && row.education_spending !== 0) {
    return [
      {
        kind: 'spending_without_pupils',
        ...base,
        stated,
        recomputed_spending_per_pupil: null,
        note: 'Education spending is stated with zero pupils, so no per-pupil figure can be formed.',
      },
    ];
  }
  if (row.pupils !== 0 && row.education_spending === 0) {
    return [
      {
        kind: 'pupils_without_spending',
        ...base,
        stated,
        recomputed_spending_per_pupil: 0,
        note: 'Pupils are stated with zero education spending.',
      },
    ];
  }
  if (row.pupils === 0) return [];
  const recomputed = round2(row.education_spending / row.pupils);
  if (Math.abs(recomputed - row.spending_per_pupil) <= 0.01 + 1e-9) return [];
  return [
    {
      kind: 'per_pupil_not_spending_over_pupils',
      ...base,
      stated,
      recomputed_spending_per_pupil: recomputed,
      note:
        'The stated per-pupil figure is not education spending divided by pupils. Kept as ' +
        'stated; the released file does not show how it was reached.',
    },
  ];
}

export function buildYear(sheet: ParsedSheet, opts: BuildOptions): YearRecord {
  const town = lookupFor(opts.registry, ['town']);
  const district = lookupFor(opts.registry, ['town', 'ud', 'sd']);
  const su = lookupFor(opts.registry, ['su']);
  const suSlug = (n: number): string | null => su(`SU${String(n).padStart(3, '0')}`)?.slug ?? null;

  const unresolved: YearRecord['unresolved_rows'][number][] = [];
  const unresolvedOnce = new Set<string>();
  const resolve = (lookup: Lookup, id: string, name: string, row: RawRow): string | null => {
    const slug = lookup(id)?.slug ?? null;
    if (slug === null && !unresolvedOnce.has(`${row.row_type}:${id}`)) {
      unresolvedOnce.add(`${row.row_type}:${id}`);
      unresolved.push({
        aoe_org_id: id,
        name_as_published: name,
        row_type: row.row_type,
        source_row: row.source_row,
        note: `AOE ID "${id}" matches no registry record. Kept with entity null; published nowhere.`,
      });
    }
    return slug;
  };

  const links = new Map<string, UnionLink[]>();
  for (const r of sheet.rows) {
    if (r.row_type !== 'town_in_union') continue;
    const dst = r.dst_id as string;
    const list = links.get(r.gov_id) ?? [];
    list.push({
      entity: resolve(district, dst, r.dst_name as string, r),
      aoe_org_id: dst,
      name_as_published: r.dst_name as string,
      source_row: r.source_row,
    });
    links.set(r.gov_id, list);
  }

  const towns: TownRecord[] = [];
  const districts: DistrictRecord[] = [];
  const discrepancies: Discrepancy[] = [];
  for (const r of sheet.rows) {
    if (r.row_type === 'town') {
      const textRates = [r.homestead_rate, r.nonhomestead_rate].filter((x) => typeof x === 'string');
      towns.push({
        entity: resolve(town, r.gov_id, r.gov_name, r),
        aoe_org_id: r.gov_id,
        name_as_published: r.gov_name,
        county: r.county as string,
        su: suSlug(r.su_number as number),
        su_number: r.su_number as number,
        homestead_rate: rateValue(r.homestead_rate),
        nonhomestead_rate: rateValue(r.nonhomestead_rate),
        rates_as_published: textRates.length > 0 ? [...new Set(textRates)].join(', ') : null,
        union_districts: links.get(r.gov_id) ?? [],
        source_row: r.source_row,
      });
    }
    if (r.row_type === 'town' || r.row_type === 'union_district') {
      if (r.pupils === 0 && r.education_spending === 0) continue;
      const entity =
        r.row_type === 'town'
          ? (town(r.gov_id)?.slug ?? null)
          : resolve(district, r.gov_id, r.gov_name, r);
      districts.push({
        entity,
        aoe_org_id: r.gov_id,
        district_type: r.row_type === 'town' ? 'town' : 'union',
        name_as_published: r.dst_name as string,
        county: r.county as string,
        su: suSlug(r.su_number as number),
        su_number: r.su_number as number,
        pupils: r.pupils,
        education_spending: r.education_spending,
        spending_per_pupil: r.spending_per_pupil,
        source_row: r.source_row,
      });
      discrepancies.push(...discrepanciesFor(r, entity));
    }
  }

  for (const r of [...towns, ...districts]) {
    if (r.su === null) {
      throw new Error(
        `${sheet.sheet}!row ${r.source_row}: S.U. ${r.su_number} matches no supervisory union ` +
          `in the registry. Run npm run registry:sync, or record the SU before importing.`,
      );
    }
  }

  return {
    schema_version: '1.0',
    source: opts.source,
    sheet: sheet.sheet,
    fiscal_year: sheet.fiscal_year,
    pupil_measure: PUPIL_MEASURES[sheet.pupil_measure],
    pupil_measure_as_published: sheet.pupil_measure,
    rates_status: RATE_LABELS[sheet.rate_label],
    rates_label_as_published: sheet.rate_label,
    banner: sheet.banner,
    statewide_total: {
      pupils: sheet.total.pupils,
      education_spending: sheet.total.education_spending,
      spending_per_pupil: sheet.total.spending_per_pupil,
      source_row: sheet.total.source_row,
    },
    towns,
    districts,
    discrepancies,
    unresolved_rows: unresolved,
    extracted_by: opts.extracted_by,
    extracted_date: opts.extracted_date,
  };
}
