/**
 * The combiner page's pure logic, kept out of the DOM so it is unit-tested.
 *
 * `planCombiner` turns the form (a CombinerShareState, the same shape the share
 * link carries) into engine members and options, or says plainly why it will
 * not run: fewer than two districts, a district that cannot be combined yet, or
 * a box the visitor must fix. It never guesses a figure. A blank the engine can
 * name (a density, an unpublished count) is passed through as null so the
 * engine names it; a blank the engine would need a value for (the spending
 * factor, the pooled Act 84 decrease) is refused here and named.
 *
 * The rest are the words the page shows: names for slugs, the signed change in
 * plain words, and the list of what blocks a result.
 */

import {
  formatValue,
  type AdmYear,
  type CombinerMember,
  type CombinerOptions,
  type CombinerPooledInputs,
  type CombinerResult,
  type CombinerTownRow,
  type SmallSchool,
  type TownRateResult,
} from '@vt-budget/model';

import type { CombinerShareState } from './combiner-share.ts';

// combiner.json is a build artifact under site/src/generated/ (gitignored), so
// a .ts file must not import it (see the note in model-tool.ts). These types
// mirror tools/src/combiner-data.ts, which writes it; the page imports the JSON
// in .astro frontmatter and hands it to the island.
export interface CombinerAdmBand {
  value: number | null;
  source: string;
  preliminary?: boolean;
  range?: { low: number | null; low_exclusive?: boolean; high: number | null };
}

export interface CombinerAdmYear {
  year: number;
  bands: Record<string, CombinerAdmBand>;
}

export interface CombinerDistrict {
  entity: string;
  label: string;
  su: string | null;
  towns: string[];
  adm_years: CombinerAdmYear[] | null;
  spending: number | null;
  state_placed_fte: number | null;
  poverty_185_fpl: number | null;
  english_learners: number | null;
  act84_decrease: number | null;
  /** Why this district cannot be combined yet. Empty when it can. */
  blockers: string[];
}

export interface CombinerTown {
  label: string;
  cla: number | null;
  cla_source: string | null;
  published_homestead_rate: number | null;
  /** Every district that taxes this town. */
  districts: string[];
}

export interface CombinerData {
  fiscal_year: number;
  districts: Record<string, CombinerDistrict>;
  towns: Record<string, CombinerTown>;
  sus: Record<string, { label: string; districts: string[] }>;
  groupings: { number: number; name: string; members: string[] }[];
}

export const MIN_DISTRICTS_MESSAGE = 'Pick at least two districts.';

export type CombinerPlan =
  | { kind: 'too_few'; message: string }
  | { kind: 'blocked'; message: string; items: string[] }
  | { kind: 'input'; message: string; items: string[] }
  | { kind: 'ready'; members: CombinerMember[]; options: CombinerOptions };

const BAND_KEYS = ['prekindergarten', 'kindergarten_through_5', 'grades_6_through_8', 'grades_9_through_12'] as const;

const ADM_SOURCE = 'Agency of Education average daily membership, as resolved in this build';
const SPENDING_SOURCE = 'Agency of Education EdSpend education spending';

/**
 * A district's membership years for one fiscal year: that year and earlier only,
 * so a later preliminary year never slides into the average. A band the State
 * withheld is null; its range is never used as a value.
 */
export function admYearsFor(d: CombinerDistrict, fiscalYear: number): AdmYear[] {
  return (d.adm_years ?? [])
    .filter((y) => y.year <= fiscalYear)
    .sort((a, b) => a.year - b.year)
    .map((y) => ({
      fiscal_year: y.year,
      prekindergarten: y.bands[BAND_KEYS[0]]?.value ?? null,
      kindergarten_through_5: y.bands[BAND_KEYS[1]]?.value ?? null,
      grades_6_through_8: y.bands[BAND_KEYS[2]]?.value ?? null,
      grades_9_through_12: y.bands[BAND_KEYS[3]]?.value ?? null,
    }));
}

/** One engine member from the data. Its own density is never published, so it is blank. */
export function toMember(d: CombinerDistrict, data: CombinerData, school: SmallSchool | null): CombinerMember {
  return {
    entity: d.entity,
    membership: {
      entity: d.entity,
      adm_years: admYearsFor(d, data.fiscal_year),
      state_placed_fte: d.state_placed_fte,
      poverty_185_fpl: d.poverty_185_fpl,
      english_learners: d.english_learners,
      persons_per_square_mile: null,
      small_schools: school ? [school] : [],
      source: ADM_SOURCE,
    },
    education_spending: d.spending,
    spending_source: `${SPENDING_SOURCE}, FY${data.fiscal_year}`,
    act84_decrease: d.act84_decrease,
    towns: d.towns.map((t) => ({
      town: t,
      cla: data.towns[t]?.cla ?? null,
      cla_source: data.towns[t]?.cla_source ?? 'no common level of appraisal on file',
    })),
  };
}

/** Every district that taxes each town, as the engine wants it. */
export function townDistricts(data: CombinerData): Record<string, readonly string[]> {
  return Object.fromEntries(Object.entries(data.towns).map(([slug, t]) => [slug, t.districts]));
}

type Parsed = { value: number | null; bad: boolean };

/** Blank is null. Commas and a leading $ are allowed; anything else that is not a number is bad. */
function parse(raw: string): Parsed {
  const text = raw.trim().replace(/,/g, '').replace(/^\$/, '');
  if (text === '') return { value: null, bad: false };
  const value = Number(text);
  return Number.isFinite(value) ? { value, bad: false } : { value: null, bad: true };
}

const COUNT_FIELDS: ReadonlyArray<{ key: keyof CombinerPooledInputs; field: 'statePlaced' | 'poverty' | 'el'; what: string }> = [
  { key: 'state_placed_fte', field: 'statePlaced', what: 'state-placed students' },
  { key: 'poverty_185_fpl', field: 'poverty', what: 'students from lower-income homes' },
  { key: 'english_learners', field: 'el', what: 'English learners' },
];

export function planCombiner(state: CombinerShareState, data: CombinerData): CombinerPlan {
  if (state.districts.length < 2) return { kind: 'too_few', message: MIN_DISTRICTS_MESSAGE };

  const blocked: string[] = [];
  for (const slug of state.districts) {
    const d = data.districts[slug];
    if (!d) blocked.push(`${slug}: this district is not in the data this page was built with.`);
    else if (d.blockers.length > 0) blocked.push(`${nameOf(slug, data)}: ${d.blockers.join(' ')}`);
  }
  if (blocked.length > 0) {
    return {
      kind: 'blocked',
      message: 'Some districts you picked can’t be combined yet. Take them out to see the rest.',
      items: blocked,
    };
  }

  const problems: string[] = [];
  const factor = parse(state.factor);
  if (factor.value === null && !factor.bad) {
    problems.push('The spending factor is blank. Put 1 in it to keep spending the same.');
  } else if (factor.value === null || factor.value <= 0) {
    problems.push('The spending factor must be a number above 0, like 1 or 0.95.');
  }

  const act84 = parse(state.act84);
  if (act84.value === null && !act84.bad) {
    problems.push('The pooled Act 84 decrease is blank. Put 0 in it for no decrease.');
  } else if (act84.value === null || act84.value < 0) {
    problems.push('The pooled Act 84 decrease must be 0 or more, in dollars per $100, like 0.05.');
  }

  const density = parse(state.density);
  if (density.bad || (density.value !== null && density.value < 0)) {
    problems.push('Population density must be a number of people per square mile, 0 or more.');
  }

  const pooled: Record<keyof CombinerPooledInputs, number | null> = {
    state_placed_fte: null,
    poverty_185_fpl: null,
    english_learners: null,
  };
  for (const { key, field, what } of COUNT_FIELDS) {
    const p = parse(state[field]);
    if (p.bad || (p.value !== null && p.value < 0)) problems.push(`The pooled count of ${what} must be a number, 0 or more.`);
    else pooled[key] = p.value;
  }

  const avg = parse(state.avg);
  if (avg.bad || (avg.value !== null && avg.value <= 0)) {
    problems.push('The statewide average must be a dollar amount above 0.');
  }

  let school: SmallSchool | null = null;
  const schoolName = state.school.trim();
  const enrollment = parse(state.enrollment);
  if (schoolName === '') {
    if (state.enrollment.trim() !== '') problems.push('Give the small school a name, or clear its enrollment.');
  } else if (!state.districts.includes(state.schoolIn)) {
    problems.push('Pick which district the small school is in.');
  } else if (enrollment.bad || (enrollment.value !== null && enrollment.value < 0)) {
    problems.push('The small school’s enrollment must be a number of students, 0 or more.');
  } else {
    school = { name: schoolName, average_two_year_enrollment: enrollment.value };
  }

  if (problems.length > 0) return { kind: 'input', message: 'Fix these boxes first:', items: problems };

  const members = state.districts.map((slug) =>
    toMember(data.districts[slug] as CombinerDistrict, data, slug === state.schoolIn ? school : null),
  );
  return {
    kind: 'ready',
    members,
    options: {
      consolidation_factor: factor.value as number,
      pooled_act84_decrease: act84.value as number,
      pooled_persons_per_square_mile: density.value,
      statewide_average_per_pupil: avg.value,
      pooled_inputs: pooled,
      town_districts: townDistricts(data),
    },
  };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

function titleCase(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase())
      // A trailing state code ("ORFORD NH") stays in capitals.
      .replace(/ (Nh|Ny|Ma)$/, (code) => code.toUpperCase())
  );
}

/** A label as a reader expects it: all-capital labels from the State are title-cased. */
function readable(label: string): string {
  return label === label.toUpperCase() ? titleCase(label) : label;
}

/** A name a reader knows for a district or town slug; the slug itself when it is unknown. */
export function nameOf(slug: string, data: CombinerData): string {
  if (slug.startsWith('town/')) {
    const town = data.towns[slug]?.label;
    if (town) return readable(town);
  }
  const label = data.districts[slug]?.label;
  if (!label) return slug;
  return readable(label);
}

/** The picked districts' published student count for the page's year, for scale. */
export interface AdmScale {
  /** The sum of every published grade-band count, FY`year`. */
  students: number;
  year: number;
  /** False when some counts were withheld or missing, so the sum is a floor. */
  complete: boolean;
}

/**
 * The picked districts' published average daily membership for the page's
 * year, summed across all grade bands. It is the plain count, not the
 * two-year average the rate uses, and it adds no state-placed students. A band
 * the State withheld is left out and marks the sum incomplete. Null when no
 * picked district has a published count for the year.
 */
export function admScale(slugs: readonly string[], data: CombinerData): AdmScale | null {
  let students = 0;
  let complete = true;
  let any = false;
  for (const slug of slugs) {
    const year = data.districts[slug]?.adm_years?.find((y) => y.year === data.fiscal_year);
    if (!year) {
      complete = false;
      continue;
    }
    for (const key of BAND_KEYS) {
      const value = year.bands[key]?.value ?? null;
      if (value === null) complete = false;
      else {
        students += value;
        any = true;
      }
    }
  }
  return any ? { students, year: data.fiscal_year, complete } : null;
}

/** The scale line, in plain words: about how many students the picked districts have. */
export function admScaleText(scale: AdmScale | null): string {
  if (scale === null) return 'Pick districts to see how many students they have, for scale.';
  const n = Math.round(scale.students).toLocaleString('en-US');
  const what = `(average daily membership, FY${scale.year}, as published)`;
  return scale.complete
    ? `For scale: the districts you picked have about ${n} students in all ${what}.`
    : `For scale: the districts you picked have at least ${n} students in all ${what}. Some of their counts were not published, so the real number is higher.`;
}

const slugPatterns = new WeakMap<CombinerData, RegExp | null>();

/** Rewrites every known slug in an engine sentence to its name. */
export function plainText(text: string, data: CombinerData): string {
  let pattern = slugPatterns.get(data);
  if (pattern === undefined) {
    const slugs = [...new Set([...Object.keys(data.districts), ...Object.keys(data.towns)])].sort(
      (a, b) => b.length - a.length,
    );
    pattern =
      slugs.length === 0
        ? null
        : new RegExp(`(?<![\\w/-])(?:${slugs.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
    slugPatterns.set(data, pattern);
  }
  return pattern ? text.replace(pattern, (slug) => nameOf(slug, data)) : text;
}

/** A rate as billed, per $100 of property value, or plain words when it was not worked out. */
export function rateText(result: TownRateResult | null): string {
  return result === null || result.billedRate.value === null
    ? 'not worked out'
    : formatValue(result.billedRate.value, 'rate_per_100');
}

/**
 * One short line for the page's role="status" region, said in place of the
 * whole result. It counts things and does not repeat any rate, so it stays the
 * same while a number is typed and is not read out on every keystroke.
 */
export function resultStatus(plan: CombinerPlan, result: Pick<CombinerResult, 'members' | 'towns'> | null): string {
  if (plan.kind === 'too_few') return plan.message;
  if (plan.kind === 'blocked') return 'Not worked out. Some districts you picked can’t be combined yet.';
  if (plan.kind === 'input' || result === null) return 'Not worked out. Some boxes need fixing first.';
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const towns = result.towns.length;
  const worked = result.towns.filter((row) => row.pooled !== null && row.pooled.billedRate.value !== null).length;
  return (
    `${count(result.members.length, 'district')}, ${count(towns, 'town')}. ` +
    `Rate if combined worked out for ${worked} of ${count(towns, 'town')}.`
  );
}

/**
 * The signed change in plain words. No colour and no word that calls a change
 * good or bad: up and down are said the same way.
 */
export function changeText(row: Pick<CombinerTownRow, 'delta' | 'direction'>): string {
  if (row.direction === null || row.delta === null) return 'not worked out';
  if (row.direction === 'none') return 'no change';
  const amount = formatValue(Math.abs(row.delta), 'rate_per_100');
  return row.direction === 'up' ? `+${amount} (goes up)` : `−${amount} (goes down)`;
}

/** Everything that blocks the result, once each, with slugs turned into names. */
export function blockerList(result: CombinerResult, data: CombinerData): string[] {
  const all = [...result.pooled.reasons, ...result.members.flatMap((m) => m.reasons)];
  return [...new Set(all.map((r) => plainText(r, data)))];
}
