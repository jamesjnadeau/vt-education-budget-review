/**
 * Builds one warehouse record per school year from the parsed extract.
 *
 * Rows are joined to the registry on ADMTDIST, which for a town is its AOE
 * organization ID and for a residency bucket is the 900-series code the
 * registry already carries. A row that matches nothing is kept, verbatim and
 * unpublished, in unresolved_rows: a transcription that silently dropped a row
 * could not be checked against the artifact's row count.
 *
 * A town that is in the registry but not in a year's rows is NOT written here.
 * The suppression query emits a row for every town-year with at least one
 * student, so absence means zero resident students that year; the site derives
 * that at build time, where it can be explained, and the warehouse stays a
 * transcription of what was delivered.
 */

import { classifyTown, type TownClass } from '../adm/classify.ts';
import type { RegistryEntity } from '../../registry/types.ts';
import { cellsFor, type MeasurePolicy, type TownCells } from './cells.ts';
import type { ParsedExtract, RawRow, SchoolYear } from './parse.ts';
import { labelsFor } from './year.ts';

/** The rules verbatim from the extract's Information Sheet. */
export const RULE_TEXT = {
  reporting_floor:
    '1. Reporting floor - an ADMTDIST/year whose total population is < 11 is not reportable',
  primary: '2. Primary - a cell with < 11 students is withheld',
  complement: '3. Complement - a subgroup is withheld when the students NOT in it are < 11',
  pair_member:
    '4. Complementary - across the four grade bands, a lone suppressed band is derivable by ' +
    'subtraction, so the next smallest non-empty band is also suppressed',
} as const;

export interface TownRecord extends TownCells {
  readonly entity: string;
  readonly aoe_org_id: string;
  readonly town_class: TownClass;
  readonly as_published: {
    readonly ell_disclosure: string;
    readonly nslelg_disclosure: string;
    readonly bands_suppressed: number;
  };
}

export interface NotPublished {
  readonly path: string;
  readonly confirmed_by: string;
  readonly confirmed_date: string;
  readonly note: string;
}

export interface YearRecord {
  readonly schema_version: '1.0';
  readonly source: string;
  readonly method: string;
  readonly school_year: SchoolYear;
  readonly count_year: string;
  readonly fiscal_year: number;
  readonly preliminary: boolean;
  readonly preliminary_note: string | null;
  readonly grain: 'town';
  readonly min_n: 11;
  readonly suppression_rules: Record<keyof typeof RULE_TEXT, { text: string; source: string }>;
  readonly towns: ReadonlyArray<TownRecord>;
  readonly unresolved_rows: ReadonlyArray<{
    aoe_org_id: string;
    entity: null;
    row_status: TownCells['row_status'];
    note: string;
  }>;
  readonly not_published: ReadonlyArray<NotPublished>;
  readonly extracted_by: string;
  readonly extracted_date: string;
}

export interface YearPolicy {
  readonly measures: MeasurePolicy;
  readonly preliminary: boolean;
  readonly preliminary_note: string | null;
  readonly not_published: ReadonlyArray<{ path: string; note: string }>;
}

/**
 * What each delivered year usably carries. Decided by a person against the
 * artifact and the request correspondence, and recorded in the output so the
 * nulls it produces are findings, not omissions.
 */
export function policyFor(schoolYear: SchoolYear, rows: ReadonlyArray<RawRow>): YearPolicy {
  const mine = rows.filter((r) => r.school_year === schoolYear);
  const ellCodes = new Set(mine.map((r) => r.ell_disclosure));
  const ellNotCollected = ellCodes.size === 1 && ellCodes.has('not_collected');

  if (schoolYear === 'SY24') {
    if (!ellNotCollected) {
      throw new Error(
        'SY24 was expected to carry not_collected on every ELL row. It does not, so the ' +
          'SY24 policy in record.ts must be re-examined against the artifact before importing.',
      );
    }
    return {
      measures: { ell: false, nslelg: false },
      preliminary: false,
      preliminary_note: null,
      not_published: [
        {
          path: 'ell',
          note:
            'Every SY24 row carries the disclosure code not_collected with a value of 0. The ' +
            'English-learner flag was not collected in the SY24 source table, so the zeros ' +
            'are not counts and are not imported.',
        },
        {
          path: 'nslelg',
          note:
            'The ten SY24 rows with a published NSLELG value hold a figure within two percent ' +
            "of the town's total ADM, and 239 of 254 rows are withheld as complement cells, " +
            'which together show the SY24 eligibility flag was set for nearly every student. ' +
            'AOE described this ADMFPSTAT defect in correspondence; the column is not a ' +
            'free-or-reduced-lunch count and is not imported.',
        },
      ],
    };
  }

  if (ellNotCollected) {
    throw new Error(
      `${schoolYear} carries not_collected on every ELL row; record.ts has no policy for that`,
    );
  }
  if (schoolYear === 'SY26') {
    return {
      measures: { ell: true, nslelg: true },
      preliminary: true,
      preliminary_note:
        'Seventeen SY26 values carry a denominator of 220 (20 x 11) that no SY24 or SY25 ' +
        'value does, which suggests an average over eleven periods rather than a settled ' +
        'full-year count. Whether SY26 is final was asked of AOE on 2026-09-11 and had not ' +
        'been answered when this was extracted; treated as preliminary until it is.',
      not_published: [],
    };
  }
  return {
    measures: { ell: true, nslelg: true },
    preliminary: false,
    preliminary_note: null,
    not_published: [],
  };
}

export interface BuildOptions {
  readonly source: string;
  readonly method: string;
  readonly registry: ReadonlyMap<string, RegistryEntity>;
  readonly extracted_by: string;
  readonly extracted_date: string;
}

function byAoeId(registry: ReadonlyMap<string, RegistryEntity>): Map<string, RegistryEntity> {
  const out = new Map<string, RegistryEntity>();
  for (const e of registry.values()) {
    if (e.type !== 'town' || !e.aoe_org_id) continue;
    if (out.has(e.aoe_org_id)) throw new Error(`two town records carry AOE ID ${e.aoe_org_id}`);
    out.set(e.aoe_org_id, e);
  }
  return out;
}

export function schoolYears(extract: ParsedExtract): SchoolYear[] {
  return [...new Set(extract.rows.map((r) => r.school_year))].sort();
}

export function buildYear(
  extract: ParsedExtract,
  schoolYear: SchoolYear,
  opts: BuildOptions,
): YearRecord {
  for (const [key, text] of Object.entries(RULE_TEXT)) {
    if (!extract.information.some((s) => s.replace(/\s+/g, ' ') === text)) {
      throw new Error(
        `The Information Sheet no longer states rule "${key}" as recorded in record.ts. ` +
          `The rule text is transcribed verbatim and must be re-read, not patched.`,
      );
    }
  }

  const labels = labelsFor(schoolYear);
  const policy = policyFor(schoolYear, extract.rows);
  const towns = byAoeId(opts.registry);
  const ruleSource = (rule: number): string => `${opts.method} rule ${rule}, min_n = 11`;

  const resolved: TownRecord[] = [];
  const unresolved: YearRecord['unresolved_rows'][number][] = [];
  for (const row of extract.rows) {
    if (row.school_year !== schoolYear) continue;
    const cells = cellsFor(row, policy.measures);
    const entity = towns.get(row.aoe_org_id);
    if (!entity) {
      unresolved.push({
        aoe_org_id: row.aoe_org_id,
        entity: null,
        row_status: cells.row_status,
        note:
          `ADMTDIST "${row.aoe_org_id}" matches no town or residency bucket in the registry. ` +
          `Kept so the transcription is complete; published nowhere.`,
      });
      continue;
    }
    resolved.push({
      entity: entity.slug,
      aoe_org_id: row.aoe_org_id,
      town_class: classifyTown(entity),
      ...cells,
      as_published: {
        ell_disclosure: row.ell_disclosure,
        nslelg_disclosure: row.nslelg_disclosure,
        bands_suppressed: row.bands_suppressed,
      },
    });
  }
  if (resolved.length === 0) throw new Error(`no ${schoolYear} rows matched the registry`);

  return {
    schema_version: '1.0',
    source: opts.source,
    method: opts.method,
    school_year: schoolYear,
    count_year: labels.count_year,
    fiscal_year: labels.fiscal_year,
    preliminary: policy.preliminary,
    preliminary_note: policy.preliminary_note,
    grain: 'town',
    min_n: 11,
    suppression_rules: {
      reporting_floor: {
        text: RULE_TEXT.reporting_floor,
        source: ruleSource(1),
      },
      primary: { text: RULE_TEXT.primary, source: ruleSource(2) },
      complement: { text: RULE_TEXT.complement, source: ruleSource(3) },
      pair_member: { text: RULE_TEXT.pair_member, source: ruleSource(4) },
    },
    towns: resolved,
    unresolved_rows: unresolved,
    not_published: policy.not_published.map((n) => ({
      path: n.path,
      confirmed_by: opts.extracted_by,
      confirmed_date: opts.extracted_date,
      note: n.note,
    })),
    extracted_by: opts.extracted_by,
    extracted_date: opts.extracted_date,
  };
}
