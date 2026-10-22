#!/usr/bin/env node
/**
 * Imports the AOE education-spending workbook released under a records
 * request: per-town education tax rates, per-district pupils and education
 * spending, and union membership, one fiscal year per tab.
 *
 *   npm run edspend:import              write one warehouse record per fiscal year
 *   npm run edspend:import -- --check   parse and report, write nothing
 *
 * The workbook arrived in answer to a records request, so there is no
 * retrieval step to automate. A person files it under intake/ with its
 * provenance; everything after that is deterministic.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { parseWorkbook } from '../aoe/edspend/parse.ts';
import { buildYear, type YearRecord } from '../aoe/edspend/record.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';

const INTAKE = join(PATHS.intake, 'aoe-edspend');
const WAREHOUSE = join(PATHS.warehouse, 'aoe-edspend');

interface ProvenanceArtifact {
  readonly file?: string;
  readonly retrieved_by?: string;
  readonly sha256?: string;
}

function provenanceEntry(file: string): ProvenanceArtifact | null {
  const provenance = join(dirname(file), 'provenance.yaml');
  if (!existsSync(provenance)) return null;
  const data = parseYaml(readFileSync(provenance, 'utf8')) as {
    artifacts?: ProvenanceArtifact[];
  };
  return data.artifacts?.find((a) => a.file === basename(file)) ?? null;
}

function verifyHash(file: string): void {
  const entry = provenanceEntry(file);
  if (!entry?.sha256) {
    throw new Error(
      `${rel(file)} has no provenance entry with a sha256. Record the artifact first.`,
    );
  }
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (entry.sha256 !== actual) {
    throw new Error(
      `${rel(file)} does not match the sha256 in its provenance. A raw artifact is never ` +
        `edited, so a mismatch means the file changed after it was recorded.`,
    );
  }
}

function extractedBy(file: string): string {
  const entry = provenanceEntry(file);
  if (entry?.retrieved_by) return entry.retrieved_by;
  throw new Error(`${rel(file)} has no provenance entry naming who retrieved it.`);
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

function summarize(record: YearRecord): string {
  const links = record.towns.reduce((n, t) => n + t.union_districts.length, 0);
  const unions = record.districts.filter((d) => d.district_type === 'union').length;
  return (
    `${record.pupil_measure_as_published}, ${record.rates_status} rates; ` +
    `${record.towns.length} town(s), ${record.districts.length} district(s) ` +
    `(${unions} union), ${links} membership(s), ` +
    `${record.discrepancies.length} discrepancy(ies), ${record.unresolved_rows.length} unresolved`
  );
}

async function main(): Promise<number> {
  const check = process.argv.slice(2).includes('--check');
  const files = walkFiles(INTAKE, (n) => /\.xlsx$/i.test(n));
  if (files.length !== 1) {
    console.error(
      `Expected exactly one workbook under ${rel(INTAKE)}, found ${files.length}. ` +
        `A second release should supersede the first in provenance before it is imported.`,
    );
    return 1;
  }
  const file = files[0] as string;
  console.log(`\n${rel(file)}`);
  verifyHash(file);

  const sheets = await parseWorkbook(file);
  const years = sheets.map((s) => s.fiscal_year);
  if (new Set(years).size !== years.length) {
    throw new Error(`${rel(file)} has two tabs for the same fiscal year: ${years.join(', ')}`);
  }

  const registry = readRegistry();
  const opts = {
    source: rel(file),
    registry,
    extracted_by: extractedBy(file),
    extracted_date: new Date().toISOString().slice(0, 10),
  };

  for (const sheet of [...sheets].sort((a, b) => a.fiscal_year - b.fiscal_year)) {
    const record = buildYear(sheet, opts);
    console.log(`  ${record.sheet}  ${summarize(record)}`);
    if (check) continue;
    write(
      join(WAREHOUSE, `fy${record.fiscal_year}.yaml`),
      `# AOE education spending, pupils, and education tax rates, FY${record.fiscal_year}\n` +
        `# (${record.pupil_measure_as_published} pupils, ${record.rates_status} rates).\n` +
        `#\n` +
        `# Transcribed from tab ${record.sheet} of ${rel(file)}\n` +
        `# by npm run edspend:import. Do not hand-edit: re-run the import instead, so the\n` +
        `# record always matches the hashed artifact.\n` +
        `#\n` +
        `# Rates are actual rates, after the common level of appraisal. Figures are as\n` +
        `# stated; where one disagrees with the rest of its row it is listed under\n` +
        `# discrepancies and left as AOE printed it.`,
      record,
    );
  }

  console.log(`\n${check ? 'checked' : 'imported'}.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
