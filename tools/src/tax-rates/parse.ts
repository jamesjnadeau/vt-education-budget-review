/**
 * Parses the Vermont Department of Taxes "Education Property Tax Rates" sheet
 * into one typed row per town.
 *
 * The Department has changed the sheet's layout several times, so columns are
 * found by header name, never by position:
 *
 *   FY2020-FY2021   TOWN, STATUS, CALC, CLA, HS_TAXRATE, NH(S)_TAXRATE
 *   FY2022-FY2024   [SCHOOL CODE,] TOWN, <year> Reappraisal,
 *                   Common Level of Appraisal, Homestead Tax Rate, Nonhomestead Tax Rate
 *   FY2025          School Code, Town, CLA, ..., District Rate, Homestead Rate, ...
 *   FY2026 on       adds SA and CLA ÷ SA
 *
 * Rates are kept exactly as the sheet stores them (per $100). CLA is always
 * returned as a fraction (0.6659 = 66.59%): sheets before FY2025 print it as a
 * percent (101.27), and those are divided by 100. Columns a layout does not
 * have come back null.
 */

import type { Cell } from '../aoe/adm/xlsx.ts';

export interface TaxRateRow {
  readonly school_code: string | null;
  readonly town: string;
  readonly cla: number;
  readonly statewide_adjustment: number | null;
  readonly cla_over_sa: number | null;
  readonly district_rate: number | null;
  readonly homestead_rate: number | null;
  readonly nonhomestead_rate: number | null;
}

const isBlank = (c: Cell | undefined): boolean =>
  c === null || c === undefined || (typeof c === 'string' && c.trim() === '');

const norm = (c: Cell | undefined): string =>
  typeof c === 'string' ? c.trim().toLowerCase().replace(/\s+/g, ' ') : '';

function required(value: Cell | undefined, field: string, town: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Tax rate row for ${town}: ${field} is not numeric (${JSON.stringify(value)})`);
  }
  return value;
}

const optional = (value: Cell | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Header names each field has gone by, lowercased. */
const HEADERS = {
  school_code: ['school code'],
  town: ['town'],
  cla: ['cla', 'common level of appraisal'],
  statewide_adjustment: ['sa'],
  cla_over_sa: ['cla ÷ sa'],
  district_rate: ['district rate'],
  homestead_rate: ['homestead rate', 'homestead tax rate', 'hs_taxrate'],
  nonhomestead_rate: ['nonhomestead rate', 'nonhomestead tax rate', 'nhs_taxrate', 'nh_taxrate'],
} as const;

type Field = keyof typeof HEADERS;

/** A CLA above this is a percent, not a fraction. No town's CLA is 300%. */
const PERCENT_ABOVE = 3;

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export function parseTaxRates(rows: Cell[][]): TaxRateRow[] {
  const headerAt = rows.findIndex((r) => r.some((c) => norm(c) === 'town'));
  if (headerAt < 0) throw new Error('Tax rate sheet has no header row with a "Town" column');
  const header = (rows[headerAt] as Cell[]).map(norm);

  const at = (field: Field): number => header.findIndex((h) => (HEADERS[field] as readonly string[]).includes(h));
  const col = Object.fromEntries((Object.keys(HEADERS) as Field[]).map((f) => [f, at(f)])) as Record<Field, number>;
  for (const f of ['cla', 'homestead_rate'] as const) {
    if (col[f] < 0) throw new Error(`Tax rate sheet has no ${f} column (looked for ${HEADERS[f].join(', ')})`);
  }
  const cell = (row: Cell[], f: Field): Cell | undefined => (col[f] < 0 ? undefined : row[col[f]]);

  const out: TaxRateRow[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    // The data ends at the first row without a town name, or at the footnotes
    // (one filled cell: a sheet with no school code prints them under TOWN).
    if (isBlank(cell(row, 'town'))) break;
    if (row.filter((c) => !isBlank(c)).length < 2) break;
    const town = String(cell(row, 'town')).trim();
    const code = cell(row, 'school_code');
    const cla = required(cell(row, 'cla'), 'CLA', town);
    out.push({
      school_code: isBlank(code) ? null : String(code).trim().padStart(3, '0'),
      town,
      cla: cla > PERCENT_ABOVE ? round6(cla / 100) : cla,
      statewide_adjustment: optional(cell(row, 'statewide_adjustment')),
      cla_over_sa: optional(cell(row, 'cla_over_sa')),
      district_rate: optional(cell(row, 'district_rate')),
      homestead_rate: optional(cell(row, 'homestead_rate')),
      nonhomestead_rate: optional(cell(row, 'nonhomestead_rate')),
    });
  }
  return out;
}
