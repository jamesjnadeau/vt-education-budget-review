/**
 * Joins Act 84 worksheet rows to registry districts by AOE's own FY2024
 * EdSpend names. The worksheet dates from February 2024, so FY2024 is the
 * year whose names it uses. A row that matches no district, or more than
 * one, fails the import; nothing is skipped.
 */
import type { DistrictRecord } from '../edspend/record.ts';
import type { WorksheetRow } from './parse.ts';

/** Worksheet name -> FY2024 EdSpend `name_as_published`, where they differ only by abbreviation. */
export const NAME_ALIASES: Readonly<Record<string, string>> = {
  'Granville-Hancock USD': 'Granville-Hancock Unified District',
  'Essex-Westford EC USD': 'Essex-Westford ECUUSD',
  'Quarry Valley USD': 'Quarry Valley UUSD',
  'Barre USD': 'Barre UUSD',
  'Harwood USD': 'Harwood UUSD',
  'Montpelier-Roxbury USD': 'Montpelier Roxbury School District',
  'Mount Ascutney USD': 'Mount Ascutney School District',
};

export interface Act84District {
  readonly entity: string;
  readonly aoe_org_id: string;
  /** The name as the worksheet prints it. */
  readonly name_as_published: string;
  readonly su: string;
  readonly county: string;
  readonly pre_act127_ltw_adm: number;
  readonly fy2025_decrease: number;
  /** 1-based line in the worksheet .txt. */
  readonly source_line: number;
}

export interface Act84Record {
  readonly schema_version: '1.0';
  readonly source: string;
  readonly source_text: string;
  readonly fiscal_year: 2025;
  readonly names_from: string;
  readonly unlisted_decrease: 0;
  readonly total: { readonly pre_act127_ltw_adm: number; readonly source_line: number };
  readonly districts: ReadonlyArray<Act84District>;
  readonly extracted_by: string;
  readonly extracted_date: string;
}

export function resolveRows(
  rows: ReadonlyArray<WorksheetRow>,
  districts: ReadonlyArray<DistrictRecord>,
): Act84District[] {
  const out: Act84District[] = [];
  const failures: string[] = [];
  for (const row of rows) {
    const want = NAME_ALIASES[row.name] ?? row.name;
    const matches = districts.filter((d) => d.name_as_published === want);
    const where = `line ${row.line} "${row.name}"`;
    if (matches.length === 0) {
      failures.push(`${where}: no FY2024 district is named "${want}"`);
      continue;
    }
    if (matches.length > 1) {
      failures.push(`${where}: more than one FY2024 district is named "${want}"`);
      continue;
    }
    const d = matches[0]!;
    if (d.entity === null) {
      failures.push(`${where}: the FY2024 district ${d.aoe_org_id} has no registry entity`);
      continue;
    }
    out.push({
      entity: d.entity,
      aoe_org_id: d.aoe_org_id,
      name_as_published: row.name,
      su: row.su,
      county: row.county,
      pre_act127_ltw_adm: row.pre_act127_ltw_adm,
      fy2025_decrease: row.fy2025_decrease,
      source_line: row.line,
    });
  }
  if (failures.length > 0) {
    throw new Error(`Act 84 worksheet rows that do not resolve:\n  ${failures.join('\n  ')}`);
  }
  return out;
}
