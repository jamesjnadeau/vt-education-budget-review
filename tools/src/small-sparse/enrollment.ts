/**
 * Per-school October 1 enrollment from the AOE Vermont Education Dashboard
 * enrollment dataset (intake/aoe-enrollment/2026-dashboard/).
 *
 * 16 V.S.A. § 4019(a)(2): "Enrollment" means the number of students in
 * kindergarten through grade 12 who are enrolled in a school operated by the
 * school district on October 1, full-time or part-time counted as one.
 *
 * Choices, each of which could silently move a school across the threshold:
 *
 *  - Only the DC#06_FALL_ADM_Official collection is read. The year-end
 *    collection counts students who arrived after the fall count, so it is not
 *    an October 1 headcount. (Collection choice confirmed by James Nadeau, who
 *    has calculated this count for the State, 2026-11-22.)
 *  - The count is full-time kindergarten + part-time kindergarten + grades 1-12.
 *    Pre-school and the adult columns are excluded; the file's own
 *    `Non Preschool Total` includes adults, so it is NOT used.
 *  - The same school appears twice in some early years under two spellings of
 *    its name. Identical counts collapse to one; different counts make that
 *    school-year unusable rather than picking one.
 *  - School year N is the year ending in spring N. Whether the label means the
 *    fall of N-1 or N is not stated in the data; the build records the label
 *    as published and does not translate it.
 */

export const FALL_COLLECTION = 'DC#06_FALL_ADM_Official';

const COUNT_COLUMNS = [
  'Kindergarten Full Time',
  'Kindergarten Part Time',
  'First Grade',
  'Second Grade',
  'Third Grade',
  'Fourth Grade',
  'Fifth Grade',
  'Sixth Grade',
  'Seventh Grade',
  'Eighth Grade',
  'Ninth Grade',
  'Tenth Grade',
  'Eleventh Grade',
  'Twelfth Grade',
] as const;

/** RFC 4180 parser: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** AOE school identifier (e.g. PS023) -> school year -> October 1 K-12 count. */
export type FallEnrollment = Map<string, Map<number, number>>;

export function parseFallEnrollment(csvText: string): FallEnrollment {
  const [header, ...body] = parseCsv(csvText);
  if (!header) throw new Error('enrollment CSV is empty');
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`enrollment CSV has no "${name}" column`);
    return i;
  };
  const yearCol = col('School Year');
  const idCol = col('School Identifier');
  const collCol = col('Data Collection Name');
  const countCols = COUNT_COLUMNS.map(col);

  const out: FallEnrollment = new Map();
  const conflicted = new Set<string>();
  for (const r of body) {
    if (r[collCol] !== FALL_COLLECTION) continue;
    const id = r[idCol];
    const year = Number(r[yearCol]);
    if (!id || !Number.isInteger(year)) continue;
    const cells = countCols.map((c) => Number((r[c] ?? '').trim() || 0));
    if (cells.some((n) => !Number.isFinite(n) || n < 0)) continue;
    const count = cells.reduce((a, b) => a + b, 0);

    const years = out.get(id) ?? new Map<number, number>();
    out.set(id, years);
    const key = `${id}|${year}`;
    if (conflicted.has(key)) continue;
    const seen = years.get(year);
    if (seen !== undefined && seen !== count) {
      years.delete(year);
      conflicted.add(key);
    } else years.set(year, count);
  }
  return out;
}

/** The two most recent school years present anywhere in the data. */
export function latestYears(data: FallEnrollment, n = 2): number[] {
  const all = new Set<number>();
  for (const years of data.values()) for (const y of years.keys()) all.add(y);
  return [...all].sort((a, b) => b - a).slice(0, n).reverse();
}
