/**
 * Per-district data for the combiner: the inputs a visitor needs to pool two or
 * more taxing districts and see each town's homestead rate change. Emitted as
 * site/src/generated/combiner.json.
 *
 * Pure: everything is passed in already loaded. This module only joins and
 * labels. It never fills a gap. A district that cannot be pooled gets a plain
 * reason in `blockers`; a withheld grade count keeps its range for display but
 * is never turned into a value.
 */

import type { RegistryEntity } from './registry/types.ts';

export const COMBINER_FISCAL_YEAR = 2026;

export interface AdmBandInput {
  readonly value: number | null;
  readonly source: 'district' | 'aoe' | 'withheld' | 'unknown' | string;
  readonly range?: {
    readonly low: number | null;
    readonly low_exclusive?: boolean;
    readonly high: number | null;
  };
  readonly [key: string]: unknown;
}

export interface CombinerInputs {
  readonly registry: ReadonlyArray<RegistryEntity>;
  readonly resolved: {
    readonly entities: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, AdmBandInput>>>>>>;
    readonly spending: Readonly<Record<string, Readonly<Record<string, { readonly value: number }>>>>;
    readonly act84: Readonly<Record<string, { readonly value: number | null }>>;
    readonly labels: Readonly<Record<string, { readonly name: string }>>;
  };
  readonly groupings: ReadonlyArray<{ readonly number: number; readonly name: string; readonly members: readonly string[] }>;
  /** Tax Department FY2026 rows. */
  readonly taxRates: ReadonlyArray<{ readonly town: string; readonly cla: number; readonly homestead_rate?: number | null }>;
  /** EdSpend `towns[]`: published homestead rate and the union districts that serve each town. */
  readonly edspendTowns: ReadonlyArray<{
    readonly entity: string;
    readonly homestead_rate?: number | null;
    readonly union_districts?: ReadonlyArray<{ readonly entity: string | null }>;
  }>;
  /** Census land area and population per town. Optional: without it the town carries no density figures. */
  readonly censusTowns?: ReadonlyArray<{
    readonly entity: string | null;
    readonly land_area_sq_mi: number | null;
    readonly population: Readonly<Record<string, number | null>>;
  }>;
  /** Small/sparse school rows, for listing each district's schools. Informational only. */
  readonly schools?: ReadonlyArray<{
    readonly name: string;
    readonly operated_by: string | null;
    readonly grades_as_stated: string | null;
    readonly average_enrollment: number | null;
    readonly average_grade_size: number | null;
    readonly small_screen_met: boolean | null;
    readonly small_screen_blank_reason: string | null;
  }>;
}

/** One public school, with the numbers § 4019(a)'s small test uses. Not an eligibility finding. */
export interface CombinerSchool {
  readonly name: string;
  readonly grades: string | null;
  readonly average_enrollment: number | null;
  readonly average_grade_size: number | null;
  readonly small_screen_met: boolean | null;
  readonly blank_reason: string | null;
}

export interface AdmYear {
  readonly year: number;
  readonly bands: Readonly<Record<string, AdmBandInput>>;
}

export interface CombinerDistrict {
  readonly entity: string;
  readonly label: string;
  readonly su: string | null;
  readonly towns: string[];
  readonly adm_years: AdmYear[] | null;
  readonly spending: number | null;
  readonly state_placed_fte: number | null;
  readonly poverty_185_fpl: number | null;
  readonly english_learners: number | null;
  readonly act84_decrease: number | null;
  readonly schools: CombinerSchool[];
  readonly blockers: string[];
}

export interface CombinerTown {
  readonly label: string;
  readonly cla: number | null;
  readonly cla_source: string | null;
  readonly published_homestead_rate: number | null;
  /** Census land area (not total area), square miles. Null when the Census file has no row. */
  readonly land_area_sq_mi: number | null;
  /** Census 2020 count and July 1, 2025 estimate. */
  readonly population_2020: number | null;
  readonly population_2025: number | null;
  readonly districts: string[];
}

export interface CombinerData {
  readonly fiscal_year: 2026;
  readonly districts: Record<string, CombinerDistrict>;
  readonly towns: Record<string, CombinerTown>;
  readonly sus: Record<string, { label: string; districts: string[] }>;
  readonly groupings: { number: number; name: string; members: string[] }[];
}

const BAND_LABELS: Record<string, string> = {
  prekindergarten: 'prekindergarten',
  kindergarten_through_5: 'kindergarten through 5',
  grades_6_through_8: 'grades 6 through 8',
  grades_9_through_12: 'grades 9 through 12',
};

/**
 * Town names are written differently in the Tax Department table and the
 * registry ("Mount Holly" / "MT HOLLY", "Isle La Motte" / "ISLE LAMOTTE").
 */
function normalizeTown(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bmt\b/g, 'mount')
    .replace(/lamotte/g, 'la motte')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Registry towns the Tax Department lists under a different name, where the
// match is certain. The three "ID" towns are the town itself (the table has
// one row for each, with no "ID" in the name). Underhill ID / Underhill Town
// and Orford NH are left unmatched on purpose: the table has one "Underhill"
// row that could be either, and no row at all for a New Hampshire town.
const TAX_NAME_ALIASES: Record<string, string> = {
  'barton id': 'barton',
  'bennington id': 'bennington',
  'bradford id': 'bradford',
  'warrens grant': 'warren gore',
};

function isDistrictLike(e: RegistryEntity): boolean {
  return e.type === 'ud' || (e.type === 'town' && !e.operated_by && !e.reporting_only);
}

function latestSpending(
  spending: CombinerInputs['resolved']['spending'][string] | undefined,
): number | null {
  const v = spending?.[String(COMBINER_FISCAL_YEAR)]?.value;
  return typeof v === 'number' && v > 0 ? v : null;
}

function admBlockers(years: AdmYear[] | null): string[] {
  if (!years || years.length === 0) {
    return ['No average daily membership (students counted) is available.'];
  }
  const out: string[] = [];
  // The two latest years up to the fiscal year are the ones the average uses.
  // Later years are preliminary counts for a year that has not been taxed yet.
  const usable = years.filter((y) => y.year <= COMBINER_FISCAL_YEAR);
  for (const y of [...usable].sort((a, b) => b.year - a.year).slice(0, 2).sort((a, b) => a.year - b.year)) {
    for (const [band, b] of Object.entries(y.bands)) {
      if (b.source === 'withheld') {
        out.push(`Average daily membership for ${BAND_LABELS[band] ?? band} in ${y.year} is withheld by the state.`);
      } else if (b.source === 'unknown' || b.value === null) {
        out.push(`Average daily membership for ${BAND_LABELS[band] ?? band} in ${y.year} is not available.`);
      }
    }
  }
  return out;
}

export function buildCombinerData(inputs: CombinerInputs): CombinerData {
  const bySlug = new Map(inputs.registry.map((e) => [e.slug, e] as const));
  const { resolved } = inputs;

  // Towns served by each district: the registry's member towns, plus whatever
  // EdSpend says. A town that runs its own school is its own district.
  const memberTowns = new Map<string, Set<string>>();
  const addMember = (district: string, town: string): void => {
    (memberTowns.get(district) ?? memberTowns.set(district, new Set()).get(district)!).add(town);
  };
  for (const e of inputs.registry) {
    if (!isDistrictLike(e)) continue;
    if (e.type === 'ud') for (const t of e.member_towns ?? []) addMember(e.slug, t);
    else addMember(e.slug, e.slug);
  }
  for (const t of inputs.edspendTowns) {
    const own = bySlug.get(t.entity);
    if (own && own.type === 'town' && !own.operated_by && !t.union_districts?.length) addMember(t.entity, t.entity);
    for (const ud of t.union_districts ?? []) if (ud.entity) addMember(ud.entity, t.entity);
  }

  const schoolsByDistrict = new Map<string, CombinerSchool[]>();
  for (const sc of inputs.schools ?? []) {
    if (!sc.operated_by) continue;
    (schoolsByDistrict.get(sc.operated_by) ?? schoolsByDistrict.set(sc.operated_by, []).get(sc.operated_by)!).push({
      name: sc.name,
      grades: sc.grades_as_stated,
      average_enrollment: sc.average_enrollment,
      average_grade_size: sc.average_grade_size,
      small_screen_met: sc.small_screen_met,
      blank_reason: sc.small_screen_blank_reason,
    });
  }
  for (const list of schoolsByDistrict.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const districts: Record<string, CombinerDistrict> = {};
  const slugs = new Set<string>();
  for (const e of inputs.registry) {
    if (!isDistrictLike(e)) continue;
    // Keep districts that still exist or that the build has any figures for;
    // a long-closed district with nothing published is not a choice.
    const hasData =
      e.slug in resolved.entities || e.slug in resolved.spending || !e.effective_to;
    if (hasData) slugs.add(e.slug);
  }
  // A town that EdSpend lists as a district of its own (an elementary school
  // district) is one even when the registry says a union district operates it.
  for (const slug of [...Object.keys(resolved.spending), ...Object.keys(resolved.entities)]) {
    const e = bySlug.get(slug);
    if (e && (e.type === 'ud' || (e.type === 'town' && !e.reporting_only))) slugs.add(slug);
  }
  for (const g of inputs.groupings) for (const m of g.members) if (bySlug.has(m)) slugs.add(m);
  // A town district serves its own town.
  for (const slug of slugs) if (bySlug.get(slug)!.type === 'town') addMember(slug, slug);

  for (const slug of [...slugs].sort()) {
    const e = bySlug.get(slug)!;
    const raw = resolved.entities[slug];
    const adm_years: AdmYear[] | null = raw
      ? Object.entries(raw)
          .map(([year, bands]) => ({ year: Number(year), bands }))
          .sort((a, b) => a.year - b.year)
      : null;
    const spending = latestSpending(resolved.spending[slug]);
    const blockers: string[] = [];
    if (spending === null) blockers.push('No published education spending.');
    blockers.push(...admBlockers(adm_years));
    if (!memberTowns.get(slug)?.size) blockers.push('No member towns are listed for it.');
    districts[slug] = {
      entity: slug,
      label: resolved.labels[slug]?.name ?? e.name,
      su: e.supervisory_union ?? null,
      towns: [...(memberTowns.get(slug) ?? [])].sort(),
      adm_years,
      spending,
      // Not published per district in the build: the subgroup table is by town
      // of residence, English-learner counts are mostly suppressed, and the
      // free-or-reduced-lunch count is not the 185% poverty count the law uses.
      state_placed_fte: null,
      poverty_185_fpl: null,
      english_learners: null,
      act84_decrease: resolved.act84[slug]?.value ?? null,
      schools: schoolsByDistrict.get(slug) ?? [],
      blockers,
    };
  }

  // Tax Department rows by normalised name.
  const taxByName = new Map(inputs.taxRates.map((r) => [normalizeTown(r.town), r] as const));
  const edspendByTown = new Map(inputs.edspendTowns.map((t) => [t.entity, t] as const));

  const districtsOfTown = new Map<string, string[]>();
  for (const d of Object.values(districts)) {
    for (const t of d.towns) {
      (districtsOfTown.get(t) ?? districtsOfTown.set(t, []).get(t)!).push(d.entity);
    }
  }

  const censusByTown = new Map((inputs.censusTowns ?? []).map((t) => [t.entity, t] as const));
  const towns: Record<string, CombinerTown> = {};
  for (const [slug, serving] of [...districtsOfTown].sort(([a], [b]) => a.localeCompare(b))) {
    const e = bySlug.get(slug);
    if (!e) continue;
    const key = normalizeTown(e.name);
    const row = taxByName.get(TAX_NAME_ALIASES[key] ?? key);
    const rate = edspendByTown.get(slug)?.homestead_rate;
    towns[slug] = {
      label: row?.town ?? e.name,
      cla: row ? row.cla : null,
      cla_source: row ? `Vermont Tax Department FY${COMBINER_FISCAL_YEAR} education tax rates table, row "${row.town}"` : null,
      published_homestead_rate: typeof rate === 'number' ? rate : null,
      land_area_sq_mi: censusByTown.get(slug)?.land_area_sq_mi ?? null,
      population_2020: censusByTown.get(slug)?.population?.['decennial_2020'] ?? null,
      population_2025: censusByTown.get(slug)?.population?.['pep_july1_2025'] ?? null,
      districts: serving.sort(),
    };
  }

  const sus: CombinerData['sus'] = {};
  for (const d of Object.values(districts)) {
    if (!d.su) continue;
    (sus[d.su] ??= { label: bySlug.get(d.su)?.name ?? d.su, districts: [] }).districts.push(d.entity);
  }
  for (const s of Object.values(sus)) s.districts.sort();

  return {
    fiscal_year: COMBINER_FISCAL_YEAR,
    districts,
    towns,
    sus,
    groupings: inputs.groupings.map((g) => ({ number: g.number, name: g.name, members: [...g.members] })),
  };
}
