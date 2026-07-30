/**
 * Turns an AOE ADM report into band-tagged rows.
 *
 * The parser recognizes band regimes and refuses unknown ones. That refusal is
 * the design: Act 127 changed the grade bands effective July 1, 2024, only two
 * of the ten published years have been opened, and a parser that guessed at an
 * unfamiliar header would produce numbers filed under the wrong grades.
 */

import { basename } from 'node:path';

import { assertYearAgreement, parseTitleRow, type YearLabels } from './year.ts';
import { readSheetRows, type Cell } from './xlsx.ts';

export type StatutoryBand =
  | 'prekindergarten'
  | 'kindergarten_through_5'
  | 'grades_6_through_8'
  | 'grades_9_through_12';

export interface BandColumn {
  readonly header: string;
  /** Null when the published band has no § 4010 counterpart. */
  readonly statutory_band: StatutoryBand | null;
}

export interface AdmRow {
  readonly aoe_org_id: string;
  /** Retained for auditing only. Never used to identify a town. */
  readonly name_as_published: string;
  readonly values: ReadonlyArray<number | null>;
}

export interface ParsedReport {
  readonly labels: YearLabels;
  readonly bands_as_published: ReadonlyArray<BandColumn>;
  readonly maps_to_statutory_bands: boolean;
  readonly rows: ReadonlyArray<AdmRow>;
  readonly band_totals: ReadonlyArray<number>;
  readonly grand_total: number;
}

/** Collapses the inconsistent spacing AOE uses inside header labels. */
function normalizeHeader(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

interface Regime {
  readonly label: string;
  readonly headers: readonly string[];
  readonly bands: ReadonlyArray<StatutoryBand | null>;
}

/**
 * Every band regime observed in a real file.
 *
 * ADM-25 onwards matches § 4010(d)(1) exactly. ADM-24 and earlier are
 * pre-Act-127 and map to nothing: grade 6 sits inside "Elem ( K - 6)" here but
 * inside "Middle ( 6 - 8)" in ADM-25, and grades 7 and 8 sit inside
 * "SEC ( 7 - 12)" here but inside "Middle ( 6 - 8)" there. Neither report
 * publishes grade-level detail, so no arithmetic separates them, and § 4010
 * weights differ across exactly the boundary that would have to be invented.
 *
 * Add a regime here only after opening the file it came from.
 */
const REGIMES: readonly Regime[] = [
  {
    label: 'post-Act-127 three-band (ADM-25 onwards)',
    headers: ['elem ( k - 5)', 'middle ( 6 - 8)', 'sec ( 9 - 12)'],
    bands: ['kindergarten_through_5', 'grades_6_through_8', 'grades_9_through_12'],
  },
  {
    label: 'pre-Act-127 two-band (ADM-24 and earlier)',
    headers: ['elem ( k - 6)', 'sec ( 7 - 12)'],
    bands: [null, null],
  },
];

function matchRegime(headers: readonly string[]): Regime {
  const normalized = headers.map(normalizeHeader);
  const found = REGIMES.find(
    (r) =>
      r.headers.length === normalized.length &&
      r.headers.every((h, i) => h === normalized[i]),
  );
  if (found) return found;

  throw new Error(
    `Unrecognized ADM band headers: ${JSON.stringify(headers)}.\n\n` +
      `Known regimes are:\n` +
      REGIMES.map((r) => `  - ${r.label}: ${JSON.stringify(r.headers)}`).join('\n') +
      `\n\nThis is deliberate. Act 127 changed the statutory grade bands effective ` +
      `July 1, 2024, and guessing how an unfamiliar band maps onto § 4010 would file ` +
      `pupils under the wrong grades. Open the file, decide what the bands mean, and add ` +
      `a regime to REGIMES in tools/src/aoe/adm/parse.ts with a test.`,
  );
}

function cellToValue(cell: Cell): number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'string' && cell.trim() === '') return null;
  const n = Number(cell);
  if (!Number.isFinite(n)) return null;
  // The source publishes two decimals; the raw XML carries float artifacts such
  // as 79.509999999999991 for 79.51.
  return Number(n.toFixed(2));
}

export function parseRows(rows: Cell[][], filename: string): ParsedReport {
  const titleCell = rows[0]?.[0];
  if (titleCell === null || titleCell === undefined || String(titleCell).trim() === '') {
    throw new Error(`${filename}: the first row carries no title, so the year cannot be read.`);
  }
  const labels = parseTitleRow(String(titleCell));
  assertYearAgreement(labels, basename(filename));

  const headerRow = rows[1];
  if (!headerRow) throw new Error(`${filename}: no header row.`);

  // Trim only a genuine TRAILING run of blank cells -- readSheetRows already
  // does this for a real workbook, but parseRows must not depend on that,
  // since it also runs directly against hand-built row arrays. An INTERIOR
  // blank is refused below rather than compacted away: compacting would
  // re-pack the header array while values are still read from the original
  // row by position, silently attributing one band's numbers to another.
  const rawHeaders = headerRow.slice(2).map((c) => String(c ?? ''));
  let lastNonBlank = -1;
  for (let i = 0; i < rawHeaders.length; i++) {
    if (rawHeaders[i]?.trim() !== '') lastNonBlank = i;
  }
  const headers = rawHeaders.slice(0, lastNonBlank + 1);

  const interiorBlankIndex = headers.findIndex((h) => h.trim() === '');
  if (interiorBlankIndex !== -1) {
    throw new Error(
      `${filename}: header row has a blank cell between two band headers ` +
        `(data column ${interiorBlankIndex}, counting from 0 at the first band ` +
        `column) among headers ${JSON.stringify(headers)}. A band's values must ` +
        `always be read from the column its header actually occupied, so a blank ` +
        `header here cannot be skipped over -- doing so would silently attribute ` +
        `the next column's numbers to the wrong band. Open the file, find out what ` +
        `this column is, and give it a real header before parsing it.`,
    );
  }

  const regime = matchRegime(headers);

  const bands_as_published: BandColumn[] = headers.map((header, i) => ({
    header,
    statutory_band: regime.bands[i] ?? null,
  }));

  const parsedRows: AdmRow[] = [];
  for (const row of rows.slice(2)) {
    const code = String(row?.[0] ?? '').trim();
    if (code === '') continue;
    parsedRows.push({
      aoe_org_id: code,
      name_as_published: String(row?.[1] ?? '').trim(),
      values: headers.map((_, i) => cellToValue(row?.[i + 2] ?? null)),
    });
  }

  const band_totals = headers.map((_, i) =>
    Number(parsedRows.reduce((acc, r) => acc + (r.values[i] ?? 0), 0).toFixed(2)),
  );

  return {
    labels,
    bands_as_published,
    maps_to_statutory_bands: regime.bands.every((b) => b !== null),
    rows: parsedRows,
    band_totals,
    grand_total: Number(band_totals.reduce((a, b) => a + b, 0).toFixed(2)),
  };
}

export async function parseReport(absolutePath: string): Promise<ParsedReport> {
  return parseRows(await readSheetRows(absolutePath), absolutePath);
}
