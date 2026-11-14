/**
 * The load-a-district prefill's decisions, kept apart from the DOM.
 *
 * Two rules live here (docs/superpowers/specs/2026-10-22-aoe-town-sum-prefill-design.md):
 *
 * - Each band's source note: district, the state AOE count (marked preliminary
 *   for a preliminary year), withheld for student privacy, or not available.
 *   A withheld band is left blank. Under it, the range the published bounds
 *   allow, worked out at build time from each hidden town cell's own bound
 *   (the same range the SU page shows); the field is never filled from it.
 * - Keeping the two year controls in step. The prefill fills its slots from
 *   the budget-year picker, but the slot labels and the engine's ADM years come
 *   from the parameter-mode selector. So a picked year moves the selector to
 *   that year's parameter set before anything is filled, and when no parameter
 *   set exists for the year the prefill fills nothing and says so.
 *
 * Pure by design: the island reads the DOM, calls these, and writes the DOM back.
 */

/** What the published bounds allow for a withheld band, in ADM. */
export interface PrefillRange {
  readonly low: number;
  /** The true count is above `low`, not equal to it (a hidden cell holds at least one pupil). */
  readonly low_exclusive: boolean;
  /** null when a hidden town's cell has no published top. */
  readonly high: number | null;
}

export interface PrefillBand {
  readonly value: number | null;
  readonly source: 'district' | 'aoe' | 'withheld' | 'unknown';
  readonly preliminary?: true;
  readonly range?: PrefillRange;
}

export type PrefillRow = Readonly<Record<string, PrefillBand>>;

/** What one field becomes: its text, the note under it, and a range line for a withheld band. */
export interface BandFill {
  readonly value: string;
  readonly note: string;
  readonly range: string | null;
}

const adm = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * The range line under a withheld field, e.g. "Estimated range: more than 12,
 * up to 32 ADM". With no published top it says so instead of giving an upper end.
 */
export function rangeText(range: PrefillRange): string {
  const from = `${range.low_exclusive ? 'more than' : 'at least'} ${adm(range.low)}`;
  if (range.high === null) return `Estimated range: ${from} ADM (no upper limit is published for a hidden town)`;
  return `Estimated range: ${from}, up to ${adm(range.high)} ADM`;
}

export const SOURCE_NOTE = {
  district: 'from the district’s budget',
  aoe: 'from the state AOE count',
  aoePreliminary: 'from the state AOE count (preliminary)',
  withheld: 'hidden to protect student privacy; field left blank',
  unknown: 'not available',
} as const;

/**
 * A band's field text and note. A missing band (no row for the year) reads as
 * not available, the same as an explicit unknown, so a note never claims a
 * source for a value that is not there.
 */
export function bandFill(band: PrefillBand | undefined): BandFill {
  if (band?.source === 'withheld') {
    return { value: '', note: SOURCE_NOTE.withheld, range: band.range ? rangeText(band.range) : null };
  }
  if (!band || band.value === null) return { value: '', note: SOURCE_NOTE.unknown, range: null };
  if (band.source === 'district') return { value: String(band.value), note: SOURCE_NOTE.district, range: null };
  if (band.source === 'aoe') {
    return {
      value: String(band.value),
      note: band.preliminary ? SOURCE_NOTE.aoePreliminary : SOURCE_NOTE.aoe,
      range: null,
    };
  }
  return { value: '', note: SOURCE_NOTE.unknown, range: null };
}

export type PrefillPlan =
  /** Nothing picked, or no row for the pick: leave the form alone, say nothing. */
  | { readonly kind: 'none' }
  /** No parameter set for the picked year: fill nothing and say why. */
  | { readonly kind: 'no-parameters'; readonly message: string }
  /** Move the mode selector to `mode`, then fill both slots. */
  | {
      readonly kind: 'fill';
      readonly mode: string;
      readonly earlier: PrefillRow | undefined;
      readonly later: PrefillRow | undefined;
    };

/**
 * Decide what picking an entity and budget year does.
 *
 * @param entity          the picked entity slug, or '' for none
 * @param year            the picked fiscal year as the picker's value, or ''
 * @param rows            the entity's prefill rows, keyed by fiscal year
 * @param parameterYears  the fiscal years that have a live parameter set
 */
export function planAdmPrefill(
  entity: string,
  year: string,
  rows: Readonly<Record<string, PrefillRow>> | undefined,
  parameterYears: readonly number[],
): PrefillPlan {
  if (!entity || !year || !rows?.[year]) return { kind: 'none' };
  const fy = Number(year);
  if (!parameterYears.includes(fy)) {
    return {
      kind: 'no-parameters',
      message: `“Which numbers to use” has no FY${fy} option yet, so the grade counts were left as they are.`,
    };
  }
  return { kind: 'fill', mode: String(fy), earlier: rows[String(fy - 1)], later: rows[year] };
}
