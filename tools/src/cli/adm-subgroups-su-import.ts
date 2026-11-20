#!/usr/bin/env node
/**
 * Imports the AOE records-request extract of ADM by supervisory union
 * (public data request #840) into warehouse/aoe-adm-subgroups-su/, apart from
 * the town-of-residence records because its counting basis is unconfirmed.
 *
 *   npm run adm:subgroups-su             write one warehouse record per school year
 *   npm run adm:subgroups-su -- --check  parse and report, write nothing
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { buildSuYear, readSuCsv, suSchoolYears } from '../aoe/adm-subgroups/su.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';

const INTAKE = join(PATHS.intake, 'aoe-adm-subgroups-su');
const WAREHOUSE = join(PATHS.warehouse, 'aoe-adm-subgroups-su');
// No query came with the SU file. Its disclosure codes are assumed to follow
// the town extract's, so the method cited is that one.
const METHOD = join(PATHS.intake, 'aoe-adm-subgroups', 'fy2026', 'adm_ferpa_suppressed_lea.sql');

interface Artifact {
  readonly file?: string;
  readonly retrieved_by?: string;
  readonly sha256?: string;
}

function entryFor(file: string): Artifact | null {
  const p = join(dirname(file), 'provenance.yaml');
  if (!existsSync(p)) return null;
  const data = parseYaml(readFileSync(p, 'utf8')) as { artifacts?: Artifact[] };
  return (data.artifacts ?? []).find((a) => a.file === basename(file)) ?? null;
}

function verifyHash(file: string): Artifact {
  const entry = entryFor(file);
  if (!entry?.sha256) throw new Error(`${rel(file)} has no provenance entry with a sha256.`);
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (entry.sha256 !== actual) {
    throw new Error(`${rel(file)} does not match the sha256 in its provenance.`);
  }
  return entry;
}

function write(path: string, header: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${header}\n${stringifyYaml(data, { lineWidth: 88, aliasDuplicateObjects: false })}`,
    'utf8',
  );
  console.log(`  wrote ${rel(path)}`);
}

function main(): number {
  const check = process.argv.slice(2).includes('--check');
  const files = walkFiles(INTAKE, (n) => /\.csv$/i.test(n));
  if (files.length !== 1) {
    console.error(`Expected exactly one extract under ${rel(INTAKE)}, found ${files.length}.`);
    return 1;
  }
  const file = files[0] as string;
  console.log(`\n${rel(file)}`);
  const entry = verifyHash(file);
  verifyHash(METHOD);
  if (!entry.retrieved_by) throw new Error(`${rel(file)} provenance names no retrieved_by`);

  const rows = readSuCsv(file);
  const registry = readRegistry();
  const opts = {
    source: rel(file),
    method: rel(METHOD),
    registry,
    extracted_by: entry.retrieved_by,
    extracted_date: new Date().toISOString().slice(0, 10),
  };
  for (const sy of suSchoolYears(rows)) {
    const record = buildSuYear(rows, sy, opts);
    const below = record.sus.filter((s) => s.row_status === 'below_reporting_floor').length;
    console.log(
      `  ${sy}  FY${record.fiscal_year}  ${record.sus.length} SU row(s), ` +
        `${record.unresolved_rows.length} unresolved, ${below} below floor` +
        `${record.preliminary ? ', PRELIMINARY' : ''}, basis ${record.basis.observed_against_town_sums}`,
    );
    if (check) continue;
    write(
      join(WAREHOUSE, `su-${sy.toLowerCase()}.yaml`),
      `# AOE average daily membership by SUPERVISORY UNION, ${record.count_year} (${sy}).\n` +
        `#\n` +
        `# Transcribed from ${rel(file)}\n` +
        `# by npm run adm:subgroups-su. Do not hand-edit: re-run the import instead.\n` +
        `#\n` +
        `# BASIS UNCONFIRMED. AOE has not said whether these count students by SU of\n` +
        `# residence, attendance or responsibility. SY24 equals the sum of member towns'\n` +
        `# resident ADM; SY25 and SY26 do not. Do not sum towns to an SU or merge this\n` +
        `# with warehouse/aoe-adm-subgroups (town of residence). See \`basis\` below.`,
      record,
    );
  }
  console.log(`\n${check ? 'checked' : 'imported'}.`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
