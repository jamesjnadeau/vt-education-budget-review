/**
 * "Students who live here": the town-of-residence counts the site reads from
 * adm-subgroups.json, and the one derivation the site makes from them.
 *
 * The generated file is town grain and nothing in it is rolled up. A
 * supervisory union page shows the same table by adding its member towns
 * together, and that sum has to say exactly what the withheld cells allow and
 * nothing tighter:
 *
 *   - published values add up to one number;
 *   - a withheld cell with a bound (a primary or below-floor cell) widens the
 *     sum into a range, from "every hidden cell at its smallest" to "every
 *     hidden cell at its largest";
 *   - a withheld cell with no top (a pair member) or no bound at all (a
 *     complement cell) leaves only "at least";
 *   - a measure the year did not usably publish is not usable in the sum.
 *
 * Nothing here solves a bound. A hidden cell contributes only the bound AOE's
 * rules imply for it on its own.
 */

export type Cell =
  | { value: number }
  | { status: 'suppressed'; low?: number; high?: number | null; exclusive_low?: boolean }
  | { status: 'not_published' };

export type Band =
  | 'prekindergarten'
  | 'kindergarten_through_5'
  | 'grades_6_through_8'
  | 'grades_9_through_12';

export type DeliveredTownYear = {
  row: 'published' | 'below_reporting_floor';
  bands: Record<Band, Cell>;
  ell: Cell;
  nslelg: Cell;
};
export type TownYear =
  | DeliveredTownYear
  | { row: 'not_applicable'; reason: 'no_resident_students' | 'entity_closed' };

export interface Year {
  school_year: string;
  count_year: string;
  fiscal_year: number;
  preliminary: boolean;
  not_published: { path: string; note: string }[];
}

export const ROWS: { label: string; pick: (t: DeliveredTownYear) => Cell }[] = [
  { label: 'Preschool', pick: (t) => t.bands.prekindergarten },
  { label: 'Kindergarten to grade 5', pick: (t) => t.bands.kindergarten_through_5 },
  { label: 'Grades 6 to 8', pick: (t) => t.bands.grades_6_through_8 },
  { label: 'Grades 9 to 12', pick: (t) => t.bands.grades_9_through_12 },
  { label: 'English learners', pick: (t) => t.ell },
  { label: 'Can get free or reduced-price lunch', pick: (t) => t.nslelg },
];

export function count(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** The smallest whole number of students a bounded hidden cell can hold. */
function lowOf(c: Extract<Cell, { status: 'suppressed' }>): number | null {
  if (c.low === undefined) return null;
  return c.exclusive_low ? c.low + 1 : c.low;
}

/** Plain words for a withheld cell's bound, or null when the source gives none. */
export function bound(c: Extract<Cell, { status: 'suppressed' }>): string | null {
  const from = lowOf(c);
  if (from === null) return null;
  if (c.high === null || c.high === undefined) return `at least ${from} student${from === 1 ? '' : 's'}`;
  return `${from} to ${c.high} students`;
}

export type Sum =
  /** Every cell was published. */
  | { kind: 'exact'; value: number }
  /** At least one cell was hidden; `hidden` is how many. `high` is null when no top can be given. */
  | { kind: 'range'; low: number; high: number | null; hidden: number }
  /** The year did not usably publish this measure. */
  | { kind: 'not_usable' }
  /** No cells to add. */
  | { kind: 'none' };

export function sumCells(cells: ReadonlyArray<Cell>): Sum {
  if (cells.length === 0) return { kind: 'none' };
  if (cells.some((c) => 'status' in c && c.status === 'not_published')) return { kind: 'not_usable' };

  let low = 0;
  let high: number | null = 0;
  let hidden = 0;
  for (const c of cells) {
    if ('value' in c) {
      low += c.value;
      if (high !== null) high += c.value;
      continue;
    }
    if (c.status !== 'suppressed') continue; // ruled out above; keeps the type narrow
    hidden += 1;
    const from = lowOf(c);
    if (from === null) {
      // No bound at all: the cell could hold any number.
      high = null;
      continue;
    }
    low += from;
    if (c.high === null || c.high === undefined) high = null;
    else if (high !== null) high += c.high;
  }
  if (hidden === 0) return { kind: 'exact', value: low };
  return { kind: 'range', low, high, hidden };
}
