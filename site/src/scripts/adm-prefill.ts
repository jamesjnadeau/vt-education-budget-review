/**
 * The load-a-district prefill's decisions, kept apart from the DOM.
 *
 * Two rules live here (docs/superpowers/specs/2026-10-22-aoe-town-sum-prefill-design.md):
 *
 * - Each band's source note: district, the state AOE count (marked preliminary
 *   for a preliminary year), withheld for student privacy, or not available.
 *   A withheld band is left blank and carries no hint of a value.
 * - Keeping the two year controls in step. The prefill fills its slots from
 *   the budget-year picker, but the slot labels and the engine's ADM years come
 *   from the parameter-mode selector. So a picked year moves the selector to
 *   that year's parameter set before anything is filled, and when no parameter
 *   set exists for the year the prefill fills nothing and says so.
 *
 * Pure by design: the island reads the DOM, calls these, and writes the DOM back.
 */

export interface PrefillBand {
  readonly value: number | null;
  readonly source: 'district' | 'aoe' | 'withheld' | 'unknown';
  readonly preliminary?: true;
}

export type PrefillRow = Readonly<Record<string, PrefillBand>>;

/** What one field becomes: its text, and the note shown under it. */
export interface BandFill {
  readonly value: string;
  readonly note: string;
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
  if (band?.source === 'withheld') return { value: '', note: SOURCE_NOTE.withheld };
  if (!band || band.value === null) return { value: '', note: SOURCE_NOTE.unknown };
  if (band.source === 'district') return { value: String(band.value), note: SOURCE_NOTE.district };
  if (band.source === 'aoe') {
    return {
      value: String(band.value),
      note: band.preliminary ? SOURCE_NOTE.aoePreliminary : SOURCE_NOTE.aoe,
    };
  }
  return { value: '', note: SOURCE_NOTE.unknown };
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
