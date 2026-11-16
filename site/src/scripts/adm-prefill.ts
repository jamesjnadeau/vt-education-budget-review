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
 *   Where a town's cell is one of a hidden pair, a further line says which
 *   band it is paired with and that at least one of the two has 1 to 10
 *   students.
 * - Keeping the two year controls in step. The prefill fills its slots from
 *   the budget-year picker, but the slot labels and the engine's ADM years come
 *   from the parameter-mode selector. So a picked year moves the selector to
 *   that year's parameter set before anything is filled, and when no parameter
 *   set exists for the year the prefill fills nothing and says so.
 *
 * - The education spending field, from AOE's EdSpend figure for the district
 *   and year (Data Request #853). A year with no figure leaves the field blank
 *   and says so, so a previous pick's spending never stays behind.
 *   Under it, a suggestion from earlier years: at least the last year's
 *   amount, and what the recent growth would give. The field is not filled
 *   from it.
 * - The FY2025 Act 84 decrease, from AOE's Act 84 worksheet
 *   (docs/superpowers/specs/2026-11-14-act84-decrease-prefill-design.md): the
 *   worksheet's figure for a listed district, 0 for an unlisted one, and a
 *   blank field for a pick with no figure (a supervisory union) or a year whose
 *   parameter set has no transition.
 * - Which districts the picker offers, grouped by kind.
 *
 * Pure by design: the island reads the DOM, calls these, and writes the DOM back.
 */

import { titleCase } from '../lib/display.ts';

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
  readonly pairs?: ReadonlyArray<PrefillPair>;
}

/** A town whose cell in this band is hidden together with one other band. */
export interface PrefillPair {
  readonly town: string;
  readonly with: string;
}

const BAND_NAME: Readonly<Record<string, string>> = {
  prekindergarten: 'prekindergarten',
  kindergarten_through_5: 'kindergarten through grade 5',
  grades_6_through_8: 'grades 6 through 8',
  grades_9_through_12: 'grades 9 through 12',
};

export type PrefillRow = Readonly<Record<string, PrefillBand>>;

/**
 * A value the reader may choose to put in a blank field with a "use
 * suggestion" checkbox. Using it flags the figure as an estimate in the math,
 * the same way a range-estimated parameter is flagged.
 */
export interface Suggestion {
  readonly value: number;
  /** The checkbox's text. */
  readonly label: string;
  /** How the value was worked out, as a clause for the walkthrough. */
  readonly estimate: string;
  /** The value is the lowest the range allows; the real count may be higher. */
  readonly lowerLimit?: true;
}

/**
 * What one field becomes: its text, the note under it, a range line for a
 * withheld band, and a suggestion when the range has both ends.
 */
export interface BandFill {
  readonly value: string;
  readonly note: string;
  readonly range: string | null;
  readonly pair: string | null;
  readonly use?: Suggestion;
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

/**
 * The suggestion for a withheld band: the middle of the published range. A
 * range with no published top has no middle, so it offers its bottom instead,
 * marked as a lower limit: the real count may be higher.
 */
export function rangeSuggestion(range: PrefillRange): Suggestion {
  if (range.high === null) {
    return {
      value: range.low,
      label: `Use the lower limit (${adm(range.low)} ADM)`,
      estimate:
        `the bottom of the published range (${range.low_exclusive ? 'more than' : 'at least'} ${adm(range.low)}, ` +
        `with no top published), because the real count is hidden to protect student privacy`,
      lowerLimit: true,
    };
  }
  const value = Math.round(((range.low + range.high) / 2) * 100) / 100;
  return {
    value,
    label: `Use the middle of the range (${adm(value)} ADM)`,
    estimate:
      `the middle of the published range (${range.low_exclusive ? 'more than' : 'at least'} ${adm(range.low)}, ` +
      `up to ${adm(range.high)}), because the real count is hidden to protect student privacy`,
  };
}

export const SOURCE_NOTE = {
  district: 'from the district’s budget',
  aoe: 'from the state AOE count',
  aoePreliminary: 'from the state AOE count (preliminary)',
  withheld: 'hidden to protect student privacy; field left blank',
  unknown: 'not available',
} as const;

/**
 * The pair line under a withheld field, one sentence per town, e.g. "In
 * Ripton this band is hidden together with grades 6 through 8: at least one
 * of the two has 1 to 10 students, and the other may be larger."
 */
export function pairText(pairs: ReadonlyArray<PrefillPair>): string {
  return pairs
    .map(
      (p) =>
        `In ${titleCase(p.town)} this band is hidden together with ${BAND_NAME[p.with] ?? p.with}: ` +
        'at least one of the two has 1 to 10 students, and the other may be larger.',
    )
    .join(' ');
}

/**
 * A band's field text and note. A missing band (no row for the year) reads as
 * not available, the same as an explicit unknown, so a note never claims a
 * source for a value that is not there.
 */
export function bandFill(band: PrefillBand | undefined): BandFill {
  if (band?.source === 'withheld') {
    const use = band.range ? rangeSuggestion(band.range) : null;
    return {
      value: '',
      note: SOURCE_NOTE.withheld,
      range: band.range ? rangeText(band.range) : null,
      pair: band.pairs?.length ? pairText(band.pairs) : null,
      ...(use ? { use } : {}),
    };
  }
  if (!band || band.value === null) return { value: '', note: SOURCE_NOTE.unknown, range: null, pair: null };
  if (band.source === 'district') return { value: String(band.value), note: SOURCE_NOTE.district, range: null, pair: null };
  if (band.source === 'aoe') {
    return {
      value: String(band.value),
      note: band.preliminary ? SOURCE_NOTE.aoePreliminary : SOURCE_NOTE.aoe,
      range: null,
      pair: null,
    };
  }
  return { value: '', note: SOURCE_NOTE.unknown, range: null, pair: null };
}

/** AOE's education spending for one district and year. */
export interface PrefillSpending {
  readonly value: number;
  readonly pupils: number;
  readonly pupil_measure: string;
}

const PUPIL_MEASURE_NAME: Readonly<Record<string, string>> = {
  long_term_weighted_adm: 'long-term weighted pupils',
  equalized_pupils: 'equalized pupils',
};

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * The suggestion under a blank spending field, from earlier years' AOE
 * figures. Spending is expected to be at least the most recent earlier year's
 * amount. When the two most recent earlier years show growth, it also says
 * what that growth would give, rounded to the nearest thousand dollars, and
 * that is the value offered; otherwise the earlier year's amount is, marked as
 * a lower limit since spending may well be higher. The field is only filled
 * from it if the reader ticks the box.
 */
export function spendingSuggestion(
  history: Readonly<Record<string, PrefillSpending>> | undefined,
  fy: number,
): { readonly line: string; readonly use: Suggestion } | null {
  const earlier = Object.keys(history ?? {})
    .map(Number)
    .filter((y) => y < fy)
    .sort((a, b) => b - a);
  const [last, before] = earlier;
  if (last === undefined || !history) return null;
  const lastValue = history[String(last)]!.value;
  const why = `because AOE has no figure for FY${fy} yet`;
  let line = `Suggestion: at least ${usd(lastValue)}, the FY${last} amount.`;
  let use: Suggestion = {
    value: lastValue,
    label: `Use the lower limit (${usd(lastValue)})`,
    estimate: `the FY${last} AOE amount, ${why}`,
    lowerLimit: true,
  };
  if (before !== undefined) {
    const beforeValue = history[String(before)]!.value;
    if (beforeValue > 0 && lastValue > beforeValue) {
      const yearlyGrowth = (lastValue / beforeValue) ** (1 / (last - before));
      const estimate = Math.round((lastValue * yearlyGrowth ** (fy - last)) / 1000) * 1000;
      if (estimate > lastValue) {
        line += ` If it grows like it did from FY${before} to FY${last}, about ${usd(estimate)}.`;
        use = {
          value: estimate,
          label: `Use the suggestion (${usd(estimate)})`,
          estimate: `the FY${last} AOE amount, grown at the same rate as from FY${before} to FY${last}, ${why}`,
        };
      }
    }
  }
  return { line, use };
}

/**
 * The spending field's text, the note under it, and, for a year with no
 * figure, a suggestion from earlier years (see spendingSuggestion).
 */
export function spendingFill(
  spending: PrefillSpending | undefined,
  history?: Readonly<Record<string, PrefillSpending>>,
  fy?: number,
): { value: string; note: string; suggestion: string | null; use?: Suggestion } {
  if (!spending) {
    const suggested = fy === undefined ? null : spendingSuggestion(history, fy);
    return {
      value: '',
      note: 'not available from AOE for this year; field left blank',
      suggestion: suggested?.line ?? null,
      ...(suggested ? { use: suggested.use } : {}),
    };
  }
  const pupils = spending.pupils.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return {
    value: String(spending.value),
    note: `from the state AOE figure (${pupils} ${PUPIL_MEASURE_NAME[spending.pupil_measure] ?? spending.pupil_measure})`,
    suggestion: null,
  };
}

/** One district's FY2025 Act 84 decrease; `listed_as` is null when the worksheet does not list it. */
export interface Act84Entry {
  readonly value: number;
  readonly listed_as: string | null;
}

/** The Act 84 decrease field's text and the note under it. */
export function act84Fill(
  entry: Act84Entry | undefined,
  transitionApplies: boolean,
  fy: number,
): { value: string; note: string } {
  if (!transitionApplies) return { value: '', note: `does not apply in FY${fy}` };
  if (!entry) return { value: '', note: 'no AOE figure for this pick; field left blank' };
  if (entry.listed_as === null) return { value: String(entry.value), note: 'not on the state AOE worksheet, so 0' };
  return { value: String(entry.value), note: `from the state AOE worksheet (listed as ${entry.listed_as})` };
}

export interface EntityLabel {
  readonly name: string;
  readonly type: string;
}

const GROUP_ORDER: ReadonlyArray<readonly [string, string]> = [
  ['ud', 'Union school districts'],
  ['town', 'Town school districts'],
  ['su', 'Supervisory unions with a budget on file'],
];

/** The picker's option groups: each kind in a fixed order, names sorted within it. */
export function pickerGroups(
  slugs: ReadonlyArray<string>,
  labels: Readonly<Record<string, EntityLabel>>,
): Array<{ label: string; options: Array<{ value: string; text: string }> }> {
  const known = new Set(GROUP_ORDER.map(([t]) => t));
  const typeOf = (slug: string): string => {
    const t = labels[slug]?.type ?? slug.split('/')[0] ?? '';
    return known.has(t) ? t : 'other';
  };
  return [...GROUP_ORDER, ['other', 'Other'] as const]
    .map(([type, label]) => ({
      label,
      options: slugs
        .filter((slug) => typeOf(slug) === type)
        .map((slug) => ({ value: slug, text: titleCase(labels[slug]?.name ?? slug) }))
        .sort((a, b) => a.text.localeCompare(b.text)),
    }))
    .filter((g) => g.options.length > 0);
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
      readonly spending: PrefillSpending | undefined;
      /** Every year of the entity's AOE spending, for a suggestion when `spending` is missing. */
      readonly spendingHistory: Readonly<Record<string, PrefillSpending>> | undefined;
    };

/**
 * Decide what picking an entity and budget year does.
 *
 * @param entity          the picked entity slug, or '' for none
 * @param year            the picked fiscal year as the picker's value, or ''
 * @param rows            the entity's prefill rows, keyed by fiscal year
 * @param parameterYears  the fiscal years that have a live parameter set
 * @param spending        the entity's AOE spending, keyed by fiscal year
 */
export function planAdmPrefill(
  entity: string,
  year: string,
  rows: Readonly<Record<string, PrefillRow>> | undefined,
  parameterYears: readonly number[],
  spending?: Readonly<Record<string, PrefillSpending>>,
): PrefillPlan {
  if (!entity || !year || !(rows?.[year] || spending?.[year])) return { kind: 'none' };
  const fy = Number(year);
  if (!parameterYears.includes(fy)) {
    return {
      kind: 'no-parameters',
      message: `“Which numbers to use” has no FY${fy} option yet, so the grade counts and spending were left as they are.`,
    };
  }
  return { kind: 'fill', mode: String(fy), earlier: rows?.[String(fy - 1)], later: rows?.[year], spending: spending?.[year], spendingHistory: spending };
}
