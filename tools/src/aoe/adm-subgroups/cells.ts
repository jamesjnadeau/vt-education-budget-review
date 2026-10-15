/**
 * Turns one delivered row into cells that say exactly what the disclosure
 * codes allow and nothing more.
 *
 * The extract carries three disclosure signals: a code for ELL, a code for
 * NSLELG, and a count of withheld grade bands. The bands have no code of their
 * own, so what a blank band means has to be read off the suppression query's
 * structure (the `method` artifact beside the extract):
 *
 *   - rows exist only for town-years with at least one student, and the four
 *     bands are gridded, so an EMPTY band prints as 0 and a blank band is a
 *     withheld one;
 *   - rule 1 (reporting floor) blanks every cell of a row whose total is
 *     under min_n, and sets both codes to below_reporting_floor;
 *   - rule 2 (primary) blanks a band with 1..min_n-1 students;
 *   - rule 4 (pair) fires only when exactly ONE band was withheld under rule 2
 *     and blanks the next smallest non-empty band as well.
 *
 * So in a published row, 1 blank band is a primary cell; 3 or 4 blank bands
 * are all primary cells (rule 4 cannot produce them); and 2 blank bands are
 * ambiguous -- two primaries, or one primary plus a survivor that may be any
 * size -- which is recorded as a pair and bounded only by "at least one".
 *
 * Bounds are recorded; constraints are written down; neither is ever solved.
 */

import type { RawRow } from './parse.ts';

export const BANDS = [
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
] as const;
export type Band = (typeof BANDS)[number];

export type SuppressedCell =
  | {
      readonly kind: 'primary';
      readonly low: 0;
      readonly high: 10;
      readonly exclusive_low: true;
      readonly basis: 'headcount';
      readonly floor_confirmed: true;
    }
  | { readonly kind: 'complement'; readonly note: string }
  | {
      readonly kind: 'pair_member';
      readonly low: 0;
      readonly high: null;
      readonly exclusive_low: true;
      readonly basis: 'headcount';
      readonly pair: number;
    }
  | {
      readonly kind: 'reporting_floor';
      readonly low: 0;
      readonly high: 10;
      readonly exclusive_low: false;
      readonly basis: 'headcount';
    };

export type Cell = number | { readonly suppressed: SuppressedCell };

export interface SuppressionPair {
  readonly members: readonly [Band, Band];
  readonly one_of: {
    readonly both_small: {
      low: 0;
      high: 10;
      exclusive_low: true;
      basis: 'headcount';
    };
    readonly small_and_survivor: {
      readonly small: {
        low: 0;
        high: 10;
        exclusive_low: true;
        basis: 'headcount';
      };
      readonly survivor: {
        low: 10;
        high: null;
        exclusive_low: true;
        basis: 'headcount';
      };
    };
  };
  readonly sum_equals: null;
  readonly note: string;
}

export interface TownCells {
  readonly row_status: 'published' | 'below_reporting_floor';
  readonly total: null | {
    low: 0;
    high: 10;
    exclusive_low: true;
    basis: 'headcount';
  };
  readonly bands: Readonly<Record<Band, Cell>>;
  /** Null when the measure is not imported for this year (see `measures`). */
  readonly ell: Cell | null;
  readonly nslelg: Cell | null;
  readonly suppression_pairs: ReadonlyArray<SuppressionPair>;
}

/** Which of the two subgroup measures a year carries usably. */
export interface MeasurePolicy {
  readonly ell: boolean;
  readonly nslelg: boolean;
}

// Fresh objects per cell, on purpose: a shared constant would be written back
// out as YAML anchors and aliases, which the parser then refuses in bulk.
function primary(): Cell {
  return {
    suppressed: {
      kind: 'primary',
      low: 0,
      high: 10,
      exclusive_low: true,
      basis: 'headcount',
      floor_confirmed: true,
    },
  };
}
function floor(): Cell {
  return {
    suppressed: {
      kind: 'reporting_floor',
      low: 0,
      high: 10,
      exclusive_low: false,
      basis: 'headcount',
    },
  };
}

const SUBGROUP_CODES = new Set([
  'published',
  'published_true_zero',
  'primary_small_cell',
  'complement_small_cell',
  'below_reporting_floor',
  'not_collected',
]);

function fail(row: RawRow, message: string): never {
  throw new Error(`${row.aoe_org_id} ${row.school_year}: ${message}`);
}

function subgroupCell(row: RawRow, measure: 'ell' | 'nslelg', wanted: boolean): Cell | null {
  const code = measure === 'ell' ? row.ell_disclosure : row.nslelg_disclosure;
  const value = row[measure];
  if (!SUBGROUP_CODES.has(code)) fail(row, `unknown ${measure} disclosure code "${code}"`);
  if (!wanted) return null;

  switch (code) {
    case 'published':
      if (value === null) fail(row, `${measure} is published but blank`);
      return value;
    case 'published_true_zero':
      if (value !== 0) fail(row, `${measure} is published_true_zero but holds ${value}`);
      return 0;
    case 'primary_small_cell':
      if (value !== null) fail(row, `${measure} is withheld but holds ${value}`);
      return primary();
    case 'complement_small_cell':
      if (value !== null) fail(row, `${measure} is withheld but holds ${value}`);
      return {
        suppressed: {
          kind: 'complement',
          note:
            "Fewer than 11 of this town's students are outside the subgroup. The implied " +
            'lower bound would need the row total, which was not delivered, and is not computed.',
        },
      };
    case 'not_collected':
      fail(row, `${measure} is not_collected; this year must be imported with that measure off`);
    // eslint-disable-next-line no-fallthrough -- fail() never returns
    default:
      fail(row, `${measure} code "${code}" has no cell shape in a published row`);
  }
}

export function cellsFor(row: RawRow, measures: MeasurePolicy): TownCells {
  const codes = [row.ell_disclosure, row.nslelg_disclosure];
  for (const c of codes) {
    if (!SUBGROUP_CODES.has(c)) fail(row, `unknown disclosure code "${c}"`);
  }
  const belowFloor = codes.includes('below_reporting_floor');

  if (belowFloor) {
    // Rule 1 blanks the whole row and both codes together. The one exception
    // seen is a measure that was never collected for the year: its code stays
    // not_collected (with the 0 the query writes in that case) even below the
    // floor, and such a measure is off for the whole year anyway.
    const consistent = (code: string, wanted: boolean): boolean =>
      code === 'below_reporting_floor' || (code === 'not_collected' && !wanted);
    if (
      !consistent(row.ell_disclosure, measures.ell) ||
      !consistent(row.nslelg_disclosure, measures.nslelg)
    ) {
      fail(row, `one measure is below_reporting_floor and the other is not (${codes.join(', ')})`);
    }
    for (const b of BANDS)
      if (row[b] !== null) fail(row, `${b} holds ${row[b]} in a below-floor row`);
    if (measures.ell && row.ell !== null) fail(row, 'ell holds a value in a below-floor row');
    if (measures.nslelg && row.nslelg !== null)
      fail(row, 'nslelg holds a value in a below-floor row');
    return {
      row_status: 'below_reporting_floor',
      total: { low: 0, high: 10, exclusive_low: true, basis: 'headcount' },
      bands: {
        prekindergarten: floor(),
        kindergarten_through_5: floor(),
        grades_6_through_8: floor(),
        grades_9_through_12: floor(),
      },
      ell: measures.ell ? floor() : null,
      nslelg: measures.nslelg ? floor() : null,
      suppression_pairs: [],
    };
  }

  const blank = BANDS.filter((b) => row[b] === null);
  if (blank.length !== row.bands_suppressed) {
    fail(row, `${blank.length} blank band(s) but Bands_Suppressed says ${row.bands_suppressed}`);
  }

  const pairs: SuppressionPair[] = [];
  const bands = {} as Record<Band, Cell>;
  for (const b of BANDS) {
    const v = row[b];
    if (v !== null) {
      bands[b] = v;
      continue;
    }
    if (blank.length === 2) {
      bands[b] = {
        suppressed: {
          kind: 'pair_member',
          low: 0,
          high: null,
          exclusive_low: true,
          basis: 'headcount',
          pair: 0,
        },
      };
    } else {
      bands[b] = primary();
    }
  }
  if (blank.length === 2) {
    pairs.push({
      members: [blank[0] as Band, blank[1] as Band],
      one_of: {
        both_small: {
          low: 0,
          high: 10,
          exclusive_low: true,
          basis: 'headcount',
        },
        small_and_survivor: {
          small: { low: 0, high: 10, exclusive_low: true, basis: 'headcount' },
          survivor: {
            low: 10,
            high: null,
            exclusive_low: true,
            basis: 'headcount',
          },
        },
      },
      sum_equals: null,
      note:
        'Two bands withheld. Either both have 1 to 10 students, or one does and the other ' +
        'was withheld only so the first could not be recovered by subtraction (rule 4). The ' +
        'extract does not say which, so each is bounded only from below.',
    });
  }

  return {
    row_status: 'published',
    total: null,
    bands,
    ell: subgroupCell(row, 'ell', measures.ell),
    nslelg: subgroupCell(row, 'nslelg', measures.nslelg),
    suppression_pairs: pairs,
  };
}
