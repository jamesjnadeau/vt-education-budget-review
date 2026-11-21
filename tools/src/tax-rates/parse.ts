/**
 * Parses the Vermont Department of Taxes "Education Property Tax Rates" sheet
 * into one typed row per town. CLA and the rates are kept exactly as the sheet
 * stores them (CLA as a fraction, e.g. 0.6659; rates per $100).
 */

import type { Cell } from '../aoe/adm/xlsx.ts';

export interface TaxRateRow {
  readonly school_code: string;
  readonly town: string;
  readonly cla: number;
  readonly statewide_adjustment: number;
  readonly cla_over_sa: number;
  readonly district_rate: number | null;
  readonly homestead_rate: number | null;
  readonly nonhomestead_rate: number | null;
}

const isBlank = (c: Cell | undefined): boolean =>
  c === null || c === undefined || (typeof c === 'string' && c.trim() === '');

function required(value: Cell | undefined, field: string, town: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Tax rate row for ${town}: ${field} is not numeric (${JSON.stringify(value)})`);
  }
  return value;
}

const optional = (value: Cell | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseTaxRates(rows: Cell[][]): TaxRateRow[] {
  const headerAt = rows.findIndex((r) => r.some((c) => c === 'School Code'));
  if (headerAt < 0) throw new Error('Tax rate sheet has no "School Code" header row');

  const out: TaxRateRow[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    // The data ends at the first row without a school code (blank or footnotes).
    if (isBlank(row[0])) break;
    const town = String(row[1] ?? '').trim();
    out.push({
      school_code: String(row[0]).trim().padStart(3, '0'),
      town,
      cla: required(row[2], 'CLA', town),
      statewide_adjustment: required(row[3], 'SA', town),
      cla_over_sa: required(row[4], 'CLA ÷ SA', town),
      district_rate: optional(row[6]),
      homestead_rate: optional(row[7]),
      nonhomestead_rate: optional(row[9]),
    });
  }
  return out;
}
