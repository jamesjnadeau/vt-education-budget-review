/**
 * Parses the AOE education-spending workbook (EdSpend_LTWADM), released under
 * records request #853.
 *
 * One tab per fiscal year, each a printout of School Finance's year-end
 * calculation: a banner (rows 1-12) naming the internal file and who last saved
 * it, a header row (13) carrying the statewide totals, two rows of column index
 * numbers, and data from row 17 down to a "Z999 Statewide Total" row. Every
 * value is a formula into an external workbook (`[1]Control`, `[1]TOROeqpup`)
 * that was not released, so what is read here is the value Excel cached when
 * AOE last saved the file. There is no way to recompute it from the file.
 *
 * Each data row is keyed by TORO, the district ID followed by the town ID, and
 * is one of three things:
 *
 *   town            T-code district = T-code town. Carries the town's homestead
 *                   and non-homestead rates, plus pupils and spending when the
 *                   town runs its own school district (zeros when it does not).
 *   town_in_union   T-code town under a U-code district. All zeros: the row
 *                   only says the town belongs to that union.
 *   union_district  U-code district = U-code town. Pupils and spending, no rates.
 *
 * The layout is pinned cell by cell. A banner, header or row that does not look
 * the way these four tabs looked when the importer was written throws, because
 * a quietly shifted column would put spending figures under the wrong heading.
 * The sheet must also tie out to itself: district rows sum to the statewide
 * row, and the "N = " counts above each column match the rows that carry a
 * value. Discrepancies in individual rows (a per-pupil figure that is not
 * spending / pupils) are NOT thrown on: they are what AOE published, and
 * record.ts writes them down.
 */

import { readAllSheetRows, type Cell } from '../adm/xlsx.ts';

export type RowType = 'town' | 'town_in_union' | 'union_district' | 'statewide_total';
export type PupilMeasure = 'EqPup' | 'LTWADM';
/** Rates columns hold a number, or the literal "NA" AOE prints for North Bennington ID. */
export type Rate = number | 'NA';

/** 1-based row of the column headings; data starts four rows below. */
export const HEADER_ROW = 13;
export const FIRST_DATA_ROW = 17;

/** Columns A-G of the heading row. The SU heading reads "S.U." through FY25 and "SU" after. */
export const ID_HEADER = ['GovID', 'LEAID', 'DstID', null, 'TORO', 'County'] as const;
const SU_HEADINGS = new Set(['S.U.', 'SU']);

/** The two rate labels AOE has put above the rate columns (cell K6). */
export const RATE_LABELS = {
  'PV&R Official Rates': 'official',
  'AOE Unofficial rates': 'unofficial',
} as const;
export type RateLabel = keyof typeof RATE_LABELS;

export interface RawRow {
  readonly source_row: number;
  readonly row_type: RowType;
  readonly gov_id: string;
  /** Column B. Headed "LEAID" but holds the town or district name. */
  readonly gov_name: string;
  readonly dst_id: string | null;
  readonly dst_name: string | null;
  readonly toro: string;
  readonly county: string | null;
  readonly su_number: number | null;
  readonly pupils: number;
  readonly education_spending: number;
  readonly spending_per_pupil: number;
  readonly homestead_rate: Rate;
  readonly nonhomestead_rate: Rate;
}

export interface ParsedSheet {
  readonly sheet: string;
  readonly fiscal_year: number;
  readonly pupil_measure: PupilMeasure;
  readonly rate_label: RateLabel;
  /** The banner: which internal file this tab was printed from, and its last save. */
  readonly banner: {
    readonly this_file: string;
    readonly source_file: string;
    readonly last_saved_by: string;
    readonly last_saved_date: string;
  };
  readonly rows: ReadonlyArray<RawRow>;
  readonly total: RawRow;
}

function text(cell: Cell | undefined): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

/** Cell at a 1-based row and a column letter, so the checks read like the sheet. */
function at(rows: ReadonlyArray<ReadonlyArray<Cell>>, row: number, col: string): Cell {
  return rows[row - 1]?.[col.charCodeAt(0) - 65] ?? null;
}

function expectText(
  rows: ReadonlyArray<ReadonlyArray<Cell>>,
  sheet: string,
  row: number,
  col: string,
  expected: string,
): void {
  const got = text(at(rows, row, col));
  if (got !== expected) {
    throw new Error(
      `${sheet}!${col}${row} reads ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}. ` +
        `The banner has changed; re-read the tab before importing it.`,
    );
  }
}

/**
 * A figure printed to a fixed number of places. The cached value is a float
 * sum (1248.7399999999998), so it is rounded back to the places AOE prints --
 * but only if that rounding moves it by float noise, never by a real amount.
 */
function fixed(cell: Cell, places: number, where: string): number {
  if (typeof cell !== 'number' || !Number.isFinite(cell)) {
    throw new Error(`${where} is ${JSON.stringify(cell)}, not a number`);
  }
  if (cell < 0) throw new Error(`${where} is negative (${cell})`);
  const scale = 10 ** places;
  const rounded = Math.round(cell * scale) / scale;
  if (Math.abs(rounded - cell) > 1e-6) {
    throw new Error(`${where} is ${cell}, which has more than ${places} decimal places`);
  }
  return rounded;
}

function rate(cell: Cell, where: string): Rate {
  if (cell === 'NA') return 'NA';
  return fixed(cell, 4, where);
}

function classify(gov: string, dst: string, where: string): RowType {
  if (gov === 'Z999') return 'statewide_total';
  if (gov === dst && gov.startsWith('T')) return 'town';
  if (gov === dst && gov.startsWith('U')) return 'union_district';
  if (gov.startsWith('T') && dst.startsWith('U')) return 'town_in_union';
  throw new Error(`${where}: GovID ${gov} with DstID ${dst} is no row type this importer knows`);
}

const ID = /^[TUZ]\d{3}[A-Z]?$/;

function parseDataRow(cells: ReadonlyArray<Cell>, sheet: string, rowNumber: number): RawRow {
  const where = `${sheet}!row ${rowNumber}`;
  const gov = text(cells[0]);
  if (!ID.test(gov)) throw new Error(`${where}: GovID ${JSON.stringify(gov)} is not an AOE ID`);
  const dstRaw = text(cells[2]);
  const rowType = classify(gov, dstRaw, where);
  const dst = rowType === 'statewide_total' ? null : dstRaw;
  if (dst !== null && !ID.test(dst)) {
    throw new Error(`${where}: DstID ${JSON.stringify(dst)} is not an AOE ID`);
  }
  const toro = text(cells[4]);
  if (toro !== `${dst ?? gov}${gov}`) {
    throw new Error(`${where}: TORO ${toro} is not DstID + GovID (${dst ?? gov}${gov})`);
  }
  const su = cells[6] ?? null;
  if (rowType !== 'statewide_total' && (typeof su !== 'number' || !Number.isInteger(su) || su < 1)) {
    throw new Error(`${where}: S.U. ${JSON.stringify(su)} is not a supervisory union number`);
  }

  const row: RawRow = {
    source_row: rowNumber,
    row_type: rowType,
    gov_id: gov,
    gov_name: text(cells[1]),
    dst_id: dst,
    dst_name: dst === null ? null : text(cells[3]),
    toro,
    county: rowType === 'statewide_total' ? null : text(cells[5]),
    su_number: rowType === 'statewide_total' ? null : (su as number),
    pupils: fixed(cells[7] ?? null, 2, `${where} pupils (H)`),
    education_spending: fixed(cells[8] ?? null, 2, `${where} education spending (I)`),
    spending_per_pupil: fixed(cells[9] ?? null, 2, `${where} spending per pupil (J)`),
    homestead_rate: rate(cells[10] ?? null, `${where} homestead rate (K)`),
    nonhomestead_rate: rate(cells[11] ?? null, `${where} non-homestead rate (L)`),
  };
  if (row.gov_name === '') throw new Error(`${where}: blank name in column B`);

  // A membership row only says "this town belongs to this union". Figures on
  // one would be spending counted nowhere else, so they are refused, not kept.
  const zeroRates = (r: Rate): boolean => r === 0 || r === 'NA';
  if (rowType === 'town_in_union') {
    if (row.pupils || row.education_spending || row.spending_per_pupil) {
      throw new Error(`${where}: a town-in-union row carries pupils or spending`);
    }
    if (!zeroRates(row.homestead_rate) || !zeroRates(row.nonhomestead_rate)) {
      throw new Error(`${where}: a town-in-union row carries a tax rate`);
    }
  }
  if (rowType === 'union_district' || rowType === 'statewide_total') {
    if (row.homestead_rate !== 0 || row.nonhomestead_rate !== 0) {
      throw new Error(`${where}: a ${rowType} row carries a tax rate`);
    }
  }
  return row;
}

/** Pins the banner and headings, then returns what they say. */
function parseBanner(rows: ReadonlyArray<ReadonlyArray<Cell>>, sheet: string, fy: number) {
  const fyLabel = `FY${fy}`;
  const measure = text(at(rows, 9, 'H'));
  if (measure !== 'EqPup' && measure !== 'LTWADM') {
    throw new Error(`${sheet}!H9 names pupil measure ${JSON.stringify(measure)}, not EqPup or LTWADM`);
  }
  for (const [row, col, expected] of [
    [8, 'I', fyLabel],
    [8, 'J', fyLabel],
    [7, 'K', fyLabel],
    [7, 'L', fyLabel],
    [9, 'I', 'Education'],
    [10, 'I', 'Spending'],
    [9, 'J', 'Ed Spnding'],
    [10, 'J', `per ${measure}`],
    [8, 'K', 'Home'],
    [8, 'L', 'NonRes'],
    [9, 'K', 'Rates'],
    [9, 'L', 'Rates'],
    [10, 'K', 'based on'],
    [10, 'L', 'based on'],
    [11, 'K', 'DOE'],
    [11, 'L', 'DOE'],
    [12, 'K', 'calcs'],
    [12, 'L', 'calcs'],
  ] as const) {
    expectText(rows, sheet, row, col, expected);
  }

  const heading = rows[HEADER_ROW - 1] ?? [];
  const ids = ID_HEADER.map((_, i) => (heading[i] === null ? null : text(heading[i])));
  if (ids.some((h, i) => h !== ID_HEADER[i]) || !SU_HEADINGS.has(text(heading[6]))) {
    throw new Error(
      `${sheet}!A${HEADER_ROW}:G${HEADER_ROW} reads ${JSON.stringify(heading.slice(0, 7))}. ` +
        `Expected ${JSON.stringify([...ID_HEADER, 'S.U.'])}; refusing to guess which column is which.`,
    );
  }
  // Rows 14-16 are blank or hold column index numbers (FY24 on). An ID there
  // would mean the data has moved up.
  for (let r = HEADER_ROW + 1; r < FIRST_DATA_ROW; r++) {
    if (typeof at(rows, r, 'A') === 'string') {
      throw new Error(`${sheet}!A${r} holds ${JSON.stringify(at(rows, r, 'A'))}; data starts at row ${FIRST_DATA_ROW}`);
    }
  }

  const label = text(at(rows, 6, 'K'));
  if (!(label in RATE_LABELS)) {
    throw new Error(`${sheet}!K6 labels the rates ${JSON.stringify(label)}, which record.ts has no status for`);
  }

  // The library hands date-formatted cells back as Date objects, which the
  // Cell type does not admit. Excel stores a bare date as midnight UTC, so the
  // ISO prefix is the date as typed.
  const saved: unknown = at(rows, 11, 'E');
  const date = saved instanceof Date ? saved.toISOString() : text(saved as Cell);
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
    throw new Error(`${sheet}!E11 (last saved) is ${JSON.stringify(date)}, not a date`);
  }
  return {
    pupil_measure: measure as PupilMeasure,
    rate_label: label as RateLabel,
    banner: {
      this_file: text(at(rows, 5, 'C')),
      source_file: text(at(rows, 7, 'C')),
      last_saved_by: text(at(rows, 11, 'C')),
      last_saved_date: date.slice(0, 10),
    },
  };
}

/** The "N = 122" above each figure column: how many rows carry a non-zero value. */
function checkCounts(
  rows: ReadonlyArray<ReadonlyArray<Cell>>,
  sheet: string,
  data: ReadonlyArray<RawRow>,
): void {
  const fields = ['pupils', 'education_spending', 'spending_per_pupil', 'homestead_rate', 'nonhomestead_rate'] as const;
  fields.forEach((field, i) => {
    const col = String.fromCharCode(72 + i); // H..L
    const stated = /^N = (\d+)$/.exec(text(at(rows, 5, col)));
    if (!stated) throw new Error(`${sheet}!${col}5 is not an "N = " count`);
    const counted = data.filter((r) => r[field] !== 0).length;
    if (counted !== Number(stated[1])) {
      throw new Error(
        `${sheet}!${col}5 says N = ${stated[1]} but ${counted} row(s) carry a non-zero ${field}`,
      );
    }
  });
}

/** District rows must sum to the statewide row, and the heading row repeats the statewide row. */
function checkTotals(
  rows: ReadonlyArray<ReadonlyArray<Cell>>,
  sheet: string,
  data: ReadonlyArray<RawRow>,
  total: RawRow,
): void {
  const heading = rows[HEADER_ROW - 1] ?? [];
  const stated = [
    fixed(heading[7] ?? null, 2, `${sheet}!H${HEADER_ROW}`),
    fixed(heading[8] ?? null, 2, `${sheet}!I${HEADER_ROW}`),
    fixed(heading[9] ?? null, 2, `${sheet}!J${HEADER_ROW}`),
  ];
  if (
    stated[0] !== total.pupils ||
    stated[1] !== total.education_spending ||
    stated[2] !== total.spending_per_pupil
  ) {
    throw new Error(`${sheet}: the totals in row ${HEADER_ROW} differ from the Statewide Total row`);
  }
  const districts = data.filter((r) => r.row_type === 'town' || r.row_type === 'union_district');
  const pupils = districts.reduce((n, r) => n + r.pupils, 0);
  const spending = districts.reduce((n, r) => n + r.education_spending, 0);
  if (Math.abs(pupils - total.pupils) > 0.005) {
    throw new Error(`${sheet}: district pupils sum to ${pupils}, statewide row says ${total.pupils}`);
  }
  if (Math.abs(spending - total.education_spending) > 0.005) {
    throw new Error(
      `${sheet}: district spending sums to ${spending}, statewide row says ${total.education_spending}`,
    );
  }
}

export function parseSheet(sheet: string, rows: ReadonlyArray<ReadonlyArray<Cell>>): ParsedSheet {
  const m = /^FY(\d{2})$/.exec(sheet);
  if (!m) throw new Error(`Sheet "${sheet}" is not named FYnn; every tab is expected to be one fiscal year`);
  const fiscalYear = 2000 + Number(m[1]);
  const banner = parseBanner(rows, sheet, fiscalYear);

  const data: RawRow[] = [];
  let total: RawRow | null = null;
  const seen = new Set<string>();
  for (let i = FIRST_DATA_ROW - 1; i < rows.length; i++) {
    const cells = rows[i] ?? [];
    const rowNumber = i + 1;
    if (cells.every((c) => c === null || text(c) === '')) continue;
    if (total) {
      throw new Error(`${sheet}!row ${rowNumber} follows the Statewide Total row; it should be last`);
    }
    const row = parseDataRow(cells, sheet, rowNumber);
    if (seen.has(row.toro)) throw new Error(`${sheet}: duplicate TORO ${row.toro} at row ${rowNumber}`);
    seen.add(row.toro);
    if (row.row_type === 'statewide_total') total = row;
    else data.push(row);
  }
  if (!total) throw new Error(`${sheet} has no Z999 Statewide Total row`);

  const towns = new Set(data.filter((r) => r.row_type === 'town').map((r) => r.gov_id));
  const unions = new Set(data.filter((r) => r.row_type === 'union_district').map((r) => r.gov_id));
  for (const r of data) {
    if (r.row_type !== 'town_in_union') continue;
    if (!towns.has(r.gov_id) || !unions.has(r.dst_id as string)) {
      throw new Error(
        `${sheet}!row ${r.source_row}: membership ${r.toro} names a town or union with no row of its own`,
      );
    }
  }

  checkCounts(rows, sheet, data);
  checkTotals(rows, sheet, data, total);
  return { sheet, fiscal_year: fiscalYear, ...banner, rows: data, total };
}

export async function parseWorkbook(absolutePath: string): Promise<ParsedSheet[]> {
  const sheets = await readAllSheetRows(absolutePath);
  return sheets.map((s) => parseSheet(s.name, s.rows));
}
