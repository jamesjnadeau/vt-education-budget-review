/**
 * The only module that knows which spreadsheet library we use.
 *
 * read-excel-file was chosen because it is read-only by design, actively
 * maintained, MIT, and pulls four small dependencies. The alternatives were all
 * worse for this repo: exceljs is stale and drags in archiver and unzipper for
 * write support we never use; node-xlsx resolves SheetJS from a CDN tarball,
 * which defeats lockfile-verified installs; npm's xlsx is the abandoned
 * community build with unfixed advisories.
 *
 * Everything above this module sees plain arrays, so replacing the library is a
 * one-file change.
 */

import readXlsxFile from 'read-excel-file/node';

export type Cell = string | number | null;

/**
 * Every row of the workbook's first sheet.
 *
 * As of 9.x, the default export returns every sheet (`{ sheet, data }[]`)
 * rather than one sheet's rows directly (see the library's CHANGELOG); this
 * adapter narrows that back down to the first sheet so callers keep seeing a
 * plain `Cell[][]`, regardless of that upstream shape.
 *
 * Every AOE workbook seen so far has exactly one sheet, so "first sheet" has
 * always meant "the only sheet." That assumption is silent and therefore
 * dangerous: if a future workbook adds a cover or notes tab ahead of the data
 * (a plausible AOE habit), this function would quietly hand back the wrong
 * tab's rows — plausible-looking headers, wrong numbers, nothing throws. We'd
 * rather fail loudly here than have a downstream parser half-succeed on notes
 * text. So: reading sheet 0 is correct and intentional, but a workbook with
 * more than one sheet means the "only one sheet" assumption this adapter was
 * built on no longer holds, and we refuse to guess which one is data.
 *
 * The library yields `null` for empty cells and preserves numbers as numbers,
 * which matters: ADM figures must not round-trip through strings. Trailing empty
 * cells are trimmed so a row's length reflects its real width.
 */
export async function readSheetRows(absolutePath: string): Promise<Cell[][]> {
  const sheets = await readXlsxFile(absolutePath);
  if (sheets.length > 1) {
    throw new Error(
      `Expected a single-sheet workbook but found ${sheets.length}: ` +
        `${sheets.map((s) => s.sheet).join(', ')}. Reading sheet 0 unconditionally ` +
        `risks silently parsing the wrong tab (e.g. a cover sheet ahead of the data).`,
    );
  }
  const rows = (sheets[0]?.data ?? []) as Cell[][];
  return rows.map((row) => {
    let end = row.length;
    while (end > 0 && (row[end - 1] === null || row[end - 1] === '')) end--;
    return row.slice(0, end);
  });
}
