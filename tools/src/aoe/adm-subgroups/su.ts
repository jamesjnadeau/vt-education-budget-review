/**
 * Reads and records the AOE extract that sums ADM by supervisory union
 * (public data request #840), kept apart from the town-of-residence records.
 *
 * What the SU counts are a count OF is unconfirmed. SY24 equals the sum of the
 * member towns' resident ADM exactly, SY25 and SY26 do not, mostly in grades
 * 9-12 and in both directions, and suppression cannot explain it: SY25/SY26
 * hold 47 SU-band cells each below the sum of the published town values, which
 * suppression (it only hides values) can never produce. The leading guess is
 * attendance or responsibility rather than residence, to be asked of AOE. Until
 * then every record says so, and nothing may add towns to an SU or the reverse.
 */

import { readFileSync } from 'node:fs';

import type { RegistryEntity } from '../../registry/types.ts';
import { cellsFor, type TownCells } from './cells.ts';
import type { RawRow, SchoolYear } from './parse.ts';
import { RULE_TEXT, policyFor, type NotPublished } from './record.ts';
import { labelsFor } from './year.ts';

export const SU_HEADER = [
  'su',
  'school_year',
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
  'ell',
  'nslelg',
  'ell_disclosure',
  'nslelg_disclosure',
  'bands_suppressed',
] as const;

/** ADM is a quotient (e.g. over 220 days); this only strips binary float noise. */
function count(s: string, where: string): number | null {
  const t = s.trim();
  if (t === '' || t.toLowerCase() === 'null') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${where}: "${t}" is neither a count nor null`);
  return Math.round(n * 1e6) / 1e6;
}

export function parseSuCsv(text: string): RawRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if ((lines[0] ?? '').trim() !== SU_HEADER.join(',')) {
    throw new Error(
      `SU extract header is "${lines[0]}", expected "${SU_HEADER.join(',')}". The columns are ` +
        `pinned so a reordered delivery cannot file one measure under another.`,
    );
  }
  const seen = new Set<string>();
  return lines.slice(1).map((line, i) => {
    const c = line.split(',').map((x) => x.trim());
    const where = `row ${i + 2}`;
    if (c.length !== SU_HEADER.length) throw new Error(`${where}: ${c.length} columns`);
    const su = c[0] as string;
    const year = c[1] as string;
    if (!/^SU\d+$/.test(su)) throw new Error(`${where}: "${su}" is not an SU id`);
    if (!/^SY\d{2}$/.test(year)) throw new Error(`${where}: "${year}" is not a school year`);
    const key = `${su}/${year}`;
    if (seen.has(key)) throw new Error(`duplicate row for ${key}`);
    seen.add(key);
    const suppressed = Number(c[10]);
    if (!Number.isInteger(suppressed) || suppressed < 0 || suppressed > 4) {
      throw new Error(`${where}: bands_suppressed "${c[10]}" is not 0-4`);
    }
    return {
      aoe_org_id: su,
      school_year: year as SchoolYear,
      prekindergarten: count(c[2] as string, where),
      kindergarten_through_5: count(c[3] as string, where),
      grades_6_through_8: count(c[4] as string, where),
      grades_9_through_12: count(c[5] as string, where),
      ell: count(c[6] as string, where),
      nslelg: count(c[7] as string, where),
      ell_disclosure: c[8] as string,
      nslelg_disclosure: c[9] as string,
      bands_suppressed: suppressed,
    };
  });
}

export function readSuCsv(file: string): RawRow[] {
  return parseSuCsv(readFileSync(file, 'utf8'));
}

export interface SuRecord extends TownCells {
  readonly entity: string;
  readonly aoe_org_id: string;
  readonly as_published: {
    readonly ell_disclosure: string;
    readonly nslelg_disclosure: string;
    readonly bands_suppressed: number;
  };
}

export interface SuYearRecord {
  readonly schema_version: '1.0';
  readonly source: string;
  readonly method: string;
  readonly school_year: SchoolYear;
  readonly count_year: string;
  readonly fiscal_year: number;
  readonly preliminary: boolean;
  readonly preliminary_note: string | null;
  readonly grain: 'su';
  readonly min_n: 11;
  readonly basis: {
    readonly confirmed: false;
    readonly observed_against_town_sums:
      | 'equals_town_residence_sums'
      | 'differs_from_town_residence_sums';
    readonly note: string;
  };
  readonly suppression_rules: {
    readonly applicability: 'assumed_from_town_extract';
  } & Record<keyof typeof RULE_TEXT, { text: string; source: string }>;
  readonly sus: ReadonlyArray<SuRecord>;
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

export interface SuBuildOptions {
  readonly source: string;
  readonly method: string;
  readonly registry: ReadonlyMap<string, RegistryEntity>;
  readonly extracted_by: string;
  readonly extracted_date: string;
}

const BASIS_QUESTION =
  'Whether these count students by SU of residence, attendance or responsibility has not been ' +
  'confirmed by AOE (not yet asked). ';

/**
 * Our own comparison against the town-of-residence records, done 2026-11-20:
 * SY24 matched in every SU-band cell (96 of 96 comparable); SY25 and SY26 did
 * not in any SU whose towns were all published, and 47 cells each fell below the
 * sum of published town values, which suppression cannot cause.
 */
function basisFor(schoolYear: SchoolYear): SuYearRecord['basis'] {
  if (schoolYear === 'SY24') {
    return {
      confirmed: false,
      observed_against_town_sums: 'equals_town_residence_sums',
      note:
        BASIS_QUESTION +
        'SY24 equals the sum of the member towns\' resident ADM in the town-of-residence ' +
        'record in every comparable cell, which is consistent with SU of residence.',
    };
  }
  return {
    confirmed: false,
    observed_against_town_sums: 'differs_from_town_residence_sums',
    note:
      BASIS_QUESTION +
      `${schoolYear} does NOT equal the sum of member towns' resident ADM: no SU whose towns ` +
      'were all published reconciles, the gap is mostly in grades 9-12 and runs in both ' +
      'directions, and 47 SU-band cells fall below the sum of published town values, which ' +
      'suppression (it only hides values) cannot cause. Working hypothesis (James Nadeau), ' +
      'unconfirmed by AOE: SY25 and SY26 are counted by the school attended, not the town ' +
      'of residence, so tuitioned high schoolers move between SUs. Do not sum towns to an SU or merge the two series.',
  };
}

function policyNotes(schoolYear: SchoolYear): {
  preliminary_note: string | null;
  not_published: Record<string, string>;
} {
  if (schoolYear === 'SY24') {
    return {
      preliminary_note: null,
      not_published: {
        ell:
          'Every SY24 row carries the disclosure code not_collected with a value of 0. The ' +
          'English-learner flag was not collected in the SY24 source table, so the zeros are ' +
          'not counts and are not imported.',
        nslelg:
          'The SY24 eligibility flag was set for nearly every student (the ADMFPSTAT defect ' +
          'AOE described for the town extract), so the column is not a free-or-reduced-lunch ' +
          'count and is not imported. Mirrors the town record; the SU file has no ' +
          'documentation of its own.',
      },
    };
  }
  if (schoolYear === 'SY26') {
    return {
      preliminary_note:
        'SY26 is treated as preliminary, as in the town record: its values are averages over ' +
        '220 days or eleven periods of a still-running year. Whether SY26 is final was asked ' +
        'of AOE on 2026-09-11 and had not been answered when this was extracted.',
      not_published: {},
    };
  }
  return { preliminary_note: null, not_published: {} };
}

export function buildSuYear(
  rows: ReadonlyArray<RawRow>,
  schoolYear: SchoolYear,
  opts: SuBuildOptions,
): SuYearRecord {
  const labels = labelsFor(schoolYear);
  const policy = policyFor(schoolYear, rows);
  const notes = policyNotes(schoolYear);
  const sus = new Map<string, RegistryEntity>();
  for (const e of opts.registry.values()) {
    if (e.type !== 'su' || !e.aoe_org_id) continue;
    if (sus.has(e.aoe_org_id)) throw new Error(`two SU records carry AOE ID ${e.aoe_org_id}`);
    sus.set(e.aoe_org_id, e);
  }
  const ruleSource = (rule: number): string =>
    `${opts.method} rule ${rule}, min_n = 11 (assumed: no documentation came with the SU file)`;

  const resolved: SuRecord[] = [];
  const unresolved: SuYearRecord['unresolved_rows'][number][] = [];
  for (const row of rows) {
    if (row.school_year !== schoolYear) continue;
    const cells = cellsFor(row, policy.measures);
    const entity = sus.get(row.aoe_org_id);
    if (!entity) {
      unresolved.push({
        aoe_org_id: row.aoe_org_id,
        entity: null,
        row_status: cells.row_status,
        note: `"${row.aoe_org_id}" matches no supervisory union in the registry. Kept so the transcription is complete.`,
      });
      continue;
    }
    resolved.push({
      entity: entity.slug,
      aoe_org_id: row.aoe_org_id,
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
    preliminary_note: notes.preliminary_note,
    grain: 'su',
    min_n: 11,
    basis: basisFor(schoolYear),
    suppression_rules: {
      applicability: 'assumed_from_town_extract',
      reporting_floor: { text: RULE_TEXT.reporting_floor, source: ruleSource(1) },
      primary: { text: RULE_TEXT.primary, source: ruleSource(2) },
      complement: { text: RULE_TEXT.complement, source: ruleSource(3) },
      pair_member: { text: RULE_TEXT.pair_member, source: ruleSource(4) },
    },
    sus: resolved,
    unresolved_rows: unresolved,
    not_published: policy.not_published.map((n) => ({
      path: n.path,
      confirmed_by: opts.extracted_by,
      confirmed_date: opts.extracted_date,
      note: notes.not_published[n.path] ?? n.note,
    })),
    extracted_by: opts.extracted_by,
    extracted_date: opts.extracted_date,
  };
}

export function suSchoolYears(rows: ReadonlyArray<RawRow>): SchoolYear[] {
  return [...new Set(rows.map((r) => r.school_year))].sort();
}
