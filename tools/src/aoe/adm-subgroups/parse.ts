/**
 * Reads the AOE records-request extract "ADM_Sums_by_ADMTDIST_Across_Years"
 * into typed rows, one per town-of-residence and school year.
 *
 * The parser pins the header row and the sheet name and refuses anything else.
 * This file was produced by hand for one request; a second delivery with a
 * reordered column would otherwise file free-lunch counts under English
 * learners without a sound.
 *
 * Nulls arrive as the literal string "null" (the extract was written from a
 * query result with nulls rendered as text), and numbers as numbers. Nothing
 * here interprets a null: that is the next module's job, because what a blank
 * means depends on the disclosure codes beside it.
 */

import { readNamedSheetRows, type Cell } from '../adm/xlsx.ts';

export const DATA_SHEET = 'ADM_Sums_by_ADMTDIST_Across_Yea';
export const INFORMATION_SHEET = 'Information Sheet';

export const HEADER = [
  'ADMTDIST',
  'SchoolYear',
  'PreKindergarten',
  'Grades_K_Through_5',
  'Grades_6_Through_8',
  'Grades_9_Through_12',
  'ELL',
  'NSLELG',
  'ELL_Disclosure',
  'NSLELG_Disclosure',
  'Bands_Suppressed',
] as const;

export type SchoolYear = `SY${number}`;

/** One row exactly as delivered, with "null" already read as null. */
export interface RawRow {
  readonly aoe_org_id: string;
  readonly school_year: SchoolYear;
  readonly prekindergarten: number | null;
  readonly kindergarten_through_5: number | null;
  readonly grades_6_through_8: number | null;
  readonly grades_9_through_12: number | null;
  readonly ell: number | null;
  readonly nslelg: number | null;
  readonly ell_disclosure: string;
  readonly nslelg_disclosure: string;
  readonly bands_suppressed: number;
}

export interface ParsedExtract {
  /** The Information Sheet's text cells, in order, for the suppression-rule check. */
  readonly information: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<RawRow>;
}

function text(cell: Cell | undefined): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

/** A numeric cell, or null for the extract's literal "null". Anything else throws. */
function numberOrNull(cell: Cell | undefined, where: string): number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < 0) throw new Error(`${where}: ${cell} is not a count`);
    return cell;
  }
  const s = String(cell).trim();
  if (s.toLowerCase() === 'null' || s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${where}: "${s}" is neither a count nor null`);
  return n;
}

export function parseRows(rows: ReadonlyArray<ReadonlyArray<Cell>>): RawRow[] {
  const header = rows[0]?.map(text) ?? [];
  if (header.join('|') !== HEADER.join('|')) {
    throw new Error(
      `Unexpected header row.\n  expected ${HEADER.join(' | ')}\n  found    ${header.join(' | ')}\n` +
        `The column order is pinned on purpose: a reordered delivery must be looked at, not guessed at.`,
    );
  }

  const out: RawRow[] = [];
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const id = text(row[0]);
    if (id === '') {
      // A wholly blank trailing row is tolerated; a blank ID beside data is not.
      if (row.every((c) => text(c) === '')) return;
      throw new Error(`row ${line}: blank ADMTDIST beside data`);
    }
    const sy = text(row[1]);
    if (!/^SY\d{2}$/.test(sy)) throw new Error(`row ${line}: SchoolYear "${sy}" is not SYnn`);
    const bands = text(row[10]);
    const bandsSuppressed = Number(bands);
    if (!Number.isInteger(bandsSuppressed) || bandsSuppressed < 0 || bandsSuppressed > 4) {
      throw new Error(`row ${line}: Bands_Suppressed "${bands}" is not an integer 0..4`);
    }
    out.push({
      aoe_org_id: id,
      school_year: sy as SchoolYear,
      prekindergarten: numberOrNull(row[2], `row ${line} PreKindergarten`),
      kindergarten_through_5: numberOrNull(row[3], `row ${line} Grades_K_Through_5`),
      grades_6_through_8: numberOrNull(row[4], `row ${line} Grades_6_Through_8`),
      grades_9_through_12: numberOrNull(row[5], `row ${line} Grades_9_Through_12`),
      ell: numberOrNull(row[6], `row ${line} ELL`),
      nslelg: numberOrNull(row[7], `row ${line} NSLELG`),
      ell_disclosure: text(row[8]),
      nslelg_disclosure: text(row[9]),
      bands_suppressed: bandsSuppressed,
    });
  });

  const seen = new Set<string>();
  for (const r of out) {
    const key = `${r.aoe_org_id}/${r.school_year}`;
    if (seen.has(key)) throw new Error(`duplicate row for ${key}`);
    seen.add(key);
  }
  return out;
}

export async function parseExtract(absolutePath: string): Promise<ParsedExtract> {
  const info = await readNamedSheetRows(absolutePath, INFORMATION_SHEET);
  const data = await readNamedSheetRows(absolutePath, DATA_SHEET);
  return {
    information: info.flatMap((row) => row.map(text).filter((s) => s !== '')),
    rows: parseRows(data),
  };
}
