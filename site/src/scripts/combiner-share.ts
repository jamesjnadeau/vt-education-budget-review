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

/** A full shareable URL from a base (origin + pathname). */
export function shareCombinerUrl(base: string, s: CombinerShareInput): string {
  const query = encodeCombiner(s);
  return query === '' ? base : `${base}?${query}`;
}
