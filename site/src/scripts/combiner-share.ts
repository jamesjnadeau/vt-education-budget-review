/**
 * Combiner choices <-> URL, for the combiner page's shareable links.
 *
 * Same design rules as share-link.ts (the what-if tool's links), all enforced by
 * combiner-share.test.ts:
 *   - Only non-empty values are encoded. A blank field is left out of the URL, so
 *     a shared link never asserts a value the sharer did not enter.
 *   - Unknown params are ignored on decode (tracking params, hand edits, params
 *     from a later version).
 *   - Nothing here throws on a bad link. A district slug the build does not know
 *     comes back in `unknown`, and a year the page cannot run comes back in
 *     `ignoredYear`, so the page can say so in plain words.
 *
 * It touches no DOM; combiner-tool.ts reads the form into a CombinerShareState
 * and writes a decoded one back.
 */

/** Everything a combiner link can carry. Every value but the year is the form's raw text. */
export interface CombinerShareState {
  year: number;
  /** District slugs (ud/... or town/...), in the order the visitor added them. */
  districts: string[];
  factor: string;
  act84: string;
  density: string;
  statePlaced: string;
  poverty: string;
  el: string;
  school: string;
  enrollment: string;
  /** The slug of the member district the small school belongs to. */
  schoolIn: string;
  avg: string;
}

/** The shape the brief names, plus the optional pooled inputs. */
export type CombinerShareInput = Pick<CombinerShareState, 'year' | 'districts' | 'factor' | 'act84' | 'density'> &
  Partial<Omit<CombinerShareState, 'year' | 'districts' | 'factor' | 'act84' | 'density'>>;

export interface DecodedCombiner {
  state: CombinerShareState;
  /** Slugs the link named that the build does not know, in link order. */
  unknown: string[];
  /** The link's year, when the page cannot run it; null when it was fine or absent. */
  ignoredYear: string | null;
}

type TextField = Exclude<keyof CombinerShareState, 'year' | 'districts'>;

// The order here is the order params appear in the URL, after y and d.
const TEXT_FIELDS: readonly { key: TextField; param: string }[] = [
  { key: 'factor', param: 'factor' },
  { key: 'act84', param: 'act84' },
  { key: 'density', param: 'density' },
  { key: 'statePlaced', param: 'state_placed' },
  { key: 'poverty', param: 'poverty' },
  { key: 'el', param: 'el' },
  { key: 'school', param: 'school' },
  { key: 'enrollment', param: 'enrollment' },
  { key: 'schoolIn', param: 'school_in' },
  { key: 'avg', param: 'avg' },
];

const YEAR_PARAM = 'y';
const DISTRICTS_PARAM = 'd';

/** The years the combiner can run. FY2026 is the only year with per-town CLA in the build. */
export const SUPPORTED_YEARS: ReadonlySet<number> = new Set([2026]);

/** Encode the combiner's choices as a query string (no leading '?'). */
export function encodeCombiner(s: CombinerShareInput): string {
  const params = new URLSearchParams();
  params.set(YEAR_PARAM, String(s.year));
  const districts = s.districts.map((d) => d.trim()).filter((d) => d !== '');
  if (districts.length > 0) params.set(DISTRICTS_PARAM, districts.join(','));
  for (const { key, param } of TEXT_FIELDS) {
    const value = s[key];
    if (value === undefined || value.trim() === '') continue;
    params.set(param, value.trim());
  }
  return params.toString();
}

/**
 * Decode a query string (with or without '?'). `known` is every district slug in
 * the build; `years` is the set the page can run, and the first is the default.
 */
export function decodeCombiner(
  query: string,
  known: ReadonlySet<string>,
  years: ReadonlySet<number> = SUPPORTED_YEARS,
): DecodedCombiner {
  const params = new URLSearchParams(query);
  const defaultYear = [...years][0] ?? 2026;

  let year = defaultYear;
  let ignoredYear: string | null = null;
  const rawYear = (params.get(YEAR_PARAM) ?? '').trim();
  if (rawYear !== '') {
    const parsed = Number(rawYear);
    if (Number.isInteger(parsed) && years.has(parsed)) year = parsed;
    else ignoredYear = rawYear;
  }

  const districts: string[] = [];
  const unknown: string[] = [];
  for (const raw of (params.get(DISTRICTS_PARAM) ?? '').split(',')) {
    const slug = raw.trim();
    if (slug === '' || districts.includes(slug) || unknown.includes(slug)) continue;
    if (known.has(slug)) districts.push(slug);
    else unknown.push(slug);
  }

  const state: CombinerShareState = {
    year,
    districts,
    factor: '',
    act84: '',
    density: '',
    statePlaced: '',
    poverty: '',
    el: '',
    school: '',
    enrollment: '',
    schoolIn: '',
    avg: '',
  };
  for (const { key, param } of TEXT_FIELDS) {
    const value = (params.get(param) ?? '').trim();
    if (value !== '') state[key] = value;
  }
  return { state, unknown, ignoredYear };
}

/** A notice the page shows about a link: a title, a lead sentence, and a list. */
export interface LinkNote {
  title: string;
  lead: string;
  items: string[];
}

/** Each figure a link can fill, how to say it, and the value the page starts from. */
const LINK_FIGURES: readonly { key: TextField; name: string; unit?: string; start?: number }[] = [
  { key: 'factor', name: 'Spending factor', start: 1 },
  { key: 'act84', name: 'Pooled Act 84 decrease', unit: 'dollars per $100', start: 0 },
  { key: 'density', name: 'Population density', unit: 'people per square mile' },
  { key: 'statePlaced', name: 'State-placed students' },
  { key: 'poverty', name: 'Students from lower-income homes' },
  { key: 'el', name: 'English learners' },
  { key: 'enrollment', name: 'A small school’s average enrollment' },
];

/**
 * A note naming every figure a link filled in that the page would not have
 * filled on its own, so the visitor knows those numbers came from whoever made
 * the link and not from the State. A spending factor of 1 and an Act 84
 * decrease of 0 are where the page starts, so they are not listed. A statewide
 * average equal to the published one is not listed; one that differs is, and
 * says so. Null when the link filled nothing of the kind.
 */
export function linkFigureNote(state: CombinerShareState, publishedAverage: number | null): LinkNote | null {
  const items: string[] = [];
  for (const { key, name, unit, start } of LINK_FIGURES) {
    const value = state[key].trim();
    if (value === '') continue;
    if (start !== undefined && Number(value) === start) continue;
    items.push(`${name}: ${clip(value)}${unit ? ` ${unit}` : ''}.`);
  }
  const school = state.school.trim();
  if (school !== '') items.push(`A small school: ${clip(school)}.`);
  const avg = state.avg.trim();
  if (avg !== '') {
    const said = Number.isFinite(Number(avg)) ? dollars(Number(avg)) : clip(avg);
    if (publishedAverage === null) {
      items.push(`Statewide average spending per weighted student: ${said}.`);
    } else if (Number(avg) !== publishedAverage) {
      items.push(
        `Statewide average spending per weighted student: ${said}. This is not the State’s ` +
          `published figure, which is ${dollars(publishedAverage)}.`,
      );
    }
  }
  if (items.length === 0) return null;
  return {
    title: 'This link filled in some figures',
    lead:
      'These came from whoever made the link, not from the State. They are estimates, and the ' +
      'result depends heavily on them. Check them, or change them, before you rely on the result.',
    items,
  };
}

const MAX_NAMED = 3;
const MAX_NAME_LENGTH = 40;

function clip(text: string): string {
  return text.length <= MAX_NAME_LENGTH ? text : `${text.slice(0, MAX_NAME_LENGTH - 1)}…`;
}

function dollars(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/**
 * A note for the district slugs a link named that this page does not know: a
 * count, then at most three of them, each cut short, so a long or hand-made
 * link cannot fill the page. Null when there are none.
 */
export function unknownDistrictNote(unknown: readonly string[]): LinkNote | null {
  if (unknown.length === 0) return null;
  const n = unknown.length;
  const named = unknown.slice(0, MAX_NAMED).map(clip);
  const more = n - named.length;
  return {
    title:
      n === 1
        ? 'This link names a district this page does not know. It was left out.'
        : `This link names ${n} districts this page does not know. They were left out.`,
    lead: more > 0 ? `The first ${named.length} are below, and ${more} more ${more === 1 ? 'is' : 'are'} not shown.` : '',
    items: named,
  };
}

/** A full shareable URL from a base (origin + pathname). */
export function shareCombinerUrl(base: string, s: CombinerShareInput): string {
  const query = encodeCombiner(s);
  return query === '' ? base : `${base}?${query}`;
}
