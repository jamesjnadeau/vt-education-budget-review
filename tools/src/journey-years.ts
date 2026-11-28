/**
 * Per-fiscal-year figures for the "My journey" pages: each town's published
 * homestead rate, and, for the years the AOE resident district report covers,
 * its student total.
 *
 * Kept apart from combiner.json on purpose. The combiner pools one year
 * (FY2026) against that year's spending; this file only carries what a
 * resident-facing page shows for a year, for as many years as are on file.
 *
 * Pure: plain records in, a plain object out.
 */

import { normalizeTown, TAX_NAME_ALIASES } from './combiner-data.ts';

export interface RateSource {
  readonly publisher: string;
  readonly title: string;
  readonly published_date: string;
  readonly document_page: string;
}

export interface StudentsSource {
  /** Which AOE count a year's student figures come from. */
  readonly kind: 'resident_district_report' | 'town_file';
  readonly count_year: string;
  readonly title: string | null;
  readonly preliminary: boolean;
}

export interface JourneyYear {
  readonly fiscal_year: number;
  readonly rate_source: RateSource | null;
  readonly students_source: StudentsSource | null;
  /** Keyed by registry slug. `students` is set only in resident_district_report years. */
  readonly towns: Record<string, { homestead_rate: number | null; students?: number }>;
  /** Tax table rows that matched no registry town, by name as published. */
  readonly unmatched: string[];
}

export interface JourneyYears {
  readonly generated: string;
  readonly years: JourneyYear[];
}

export interface JourneyYearsInputs {
  readonly registry: ReadonlyArray<{ slug: string; name: string; type: string }>;
  readonly taxRates: ReadonlyArray<{
    fiscal_year: number;
    towns: ReadonlyArray<{ town: string; homestead_rate?: number | null }>;
  }>;
  readonly rateSources: Readonly<Record<number, RateSource | undefined>>;
  readonly admReports: ReadonlyArray<{
    fiscal_year: number;
    count_year: string;
    source_title?: string;
    towns: ReadonlyArray<{ entity: string; values: ReadonlyArray<number> }>;
  }>;
  readonly townFileYears: ReadonlyArray<{ fiscal_year: number; count_year: string; preliminary: boolean }>;
  readonly generated: string;
}

/** Apostrophes come and go between years ("Avery's Gore" in FY2023, "Averys Gore" after). */
const key = (name: string): string => normalizeTown(name.replace(/['\u2019]/g, ''));

/**
 * Names a registry town's row may carry beyond the combiner's aliases, where
 * the match is certain for every year this file covers (FY2020 on).
 *
 * - Underhill: the table has one "Underhill" row. The registry's other
 *   candidate, Underhill ID, closed on 2015-07-01, so from FY2020 the row can
 *   only be Underhill Town. (The combiner leaves it unmatched; that is its call
 *   for CLA and is not changed here.)
 * - Warrens Grant: printed "Warren Gore" in most years, "Warren's Gore" in FY2023.
 */
const EXTRA_NAMES: Record<string, string[]> = {
  'underhill town': ['underhill'],
  'warrens grant': ['warrens gore'],
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function buildJourneyYears(inputs: JourneyYearsInputs): JourneyYears {
  const registryTowns = inputs.registry.filter((e) => e.type === 'town');
  const admByYear = new Map(inputs.admReports.map((r) => [r.fiscal_year, r] as const));
  const fileByYear = new Map(inputs.townFileYears.map((y) => [y.fiscal_year, y] as const));

  const years = [...inputs.taxRates]
    .sort((a, b) => a.fiscal_year - b.fiscal_year)
    .map((table): JourneyYear => {
      const rows = new Map(table.towns.map((r) => [key(r.town), r] as const));
      const used = new Set<string>();
      const adm = admByYear.get(table.fiscal_year);
      const admTowns = new Map((adm?.towns ?? []).map((t) => [t.entity, t.values] as const));
      const file = fileByYear.get(table.fiscal_year);

      const towns: JourneyYear['towns'] = {};
      for (const e of [...registryTowns].sort((a, b) => a.slug.localeCompare(b.slug))) {
        const own = key(e.name);
        const name = [TAX_NAME_ALIASES[own] ?? own, ...(EXTRA_NAMES[own] ?? [])].find((n) => rows.has(n));
        const row = name === undefined ? undefined : rows.get(name);
        if (name !== undefined) used.add(name);
        const values = admTowns.get(e.slug);
        if (!row && !values) continue;
        towns[e.slug] = {
          homestead_rate: typeof row?.homestead_rate === 'number' ? row.homestead_rate : null,
          ...(values ? { students: round2(values.reduce((a, b) => a + b, 0)) } : {}),
        };
      }

      // The town file wins where both exist: it is what the pages already use.
      const students_source: StudentsSource | null = file
        ? { kind: 'town_file', count_year: file.count_year, title: null, preliminary: file.preliminary }
        : adm
          ? {
              kind: 'resident_district_report',
              count_year: adm.count_year,
              title: adm.source_title ?? null,
              preliminary: false,
            }
          : null;
      if (students_source?.kind !== 'resident_district_report') {
        for (const t of Object.values(towns)) delete t.students;
      }

      return {
        fiscal_year: table.fiscal_year,
        rate_source: inputs.rateSources[table.fiscal_year] ?? null,
        students_source,
        towns,
        unmatched: table.towns.filter((r) => !used.has(key(r.town))).map((r) => r.town),
      };
    });

  return { generated: inputs.generated, years };
}
