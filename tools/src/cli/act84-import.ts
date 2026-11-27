#!/usr/bin/env node
/**
 * Imports AOE's Act 84 tax rate discount worksheet (2024-02-08): the FY2025
 * decrease to each listed district's homestead tax rate, which Act 84 Sec. 3
 * (as amended by Act 183) phases out.
 *
 *   npm run act84:import              write warehouse/aoe-act84/fy2025.yaml
 *   npm run act84:import -- --check   parse and report, write nothing
 *
 * It checks the PDF's sha256 against its provenance, then reads the
 * pdftotext -layout .txt beside it. Rows are joined to the registry by the
 * district names in the FY2024 EdSpend record, the worksheet's own year.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { parseWorksheet } from '../aoe/act84/parse.ts';
import { resolveRows, type Act84Record } from '../aoe/act84/record.ts';
import type { YearRecord } from '../aoe/edspend/record.ts';
import { PATHS, rel } from '../paths.ts';

const PDF = join(
  PATHS.intake,
  'aoe-guidance',
  '2024-02-08-act-84-tax-rate-discount',
  'W~Nicole Lee~Y25 to FY29 Act 127 Tax Rate Discount by District~2-8-2024.pdf',
);
const NAMES_FROM = join(PATHS.warehouse, 'aoe-edspend', 'fy2024.yaml');
const OUT = join(PATHS.warehouse, 'aoe-act84', 'fy2025.yaml');

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

async function main(): Promise<number> {
  const check = process.argv.slice(2).includes('--check');
  console.log(`\n${rel(PDF)}`);
  verifyHash(PDF);

  const text = PDF.replace(/\.pdf$/, '.txt');
  const sheet = parseWorksheet(readFileSync(text, 'utf8'));
  const names = parseYaml(readFileSync(NAMES_FROM, 'utf8')) as YearRecord;
  const districts = resolveRows(sheet.rows, names.districts);

  const record: Act84Record = {
    schema_version: '1.0',
    source: rel(PDF),
    source_text: rel(text),
    fiscal_year: 2025,
    names_from: rel(NAMES_FROM),
    unlisted_decrease: 0,
    total: { pre_act127_ltw_adm: sheet.total.pre_act127_ltw_adm, source_line: sheet.total.line },
    districts,
    extracted_by: extractedBy(PDF),
    extracted_date: new Date().toISOString().slice(0, 10),
  };
  const total = sheet.total.pre_act127_ltw_adm.toLocaleString('en-US', { minimumFractionDigits: 2 });
  console.log(`  ${districts.length} rows, total ${total} ADM`);

  if (!check) {
    write(
      OUT,
      `# AOE Act 84 transition decrease, FY2025: the amount off each listed district's\n` +
        `# homestead tax rate, per $100 of equalized value, before Act 84 Sec. 3 phases it out.\n` +
        `#\n` +
        `# Transcribed from ${record.source_text}\n` +
        `# (pdftotext -layout output of the hashed PDF beside it) by npm run act84:import.\n` +
        `# Only the FY2025 column is read: the later columns predate Act 183 and are not\n` +
        `# divided by the statewide adjustment. A district the worksheet does not list\n` +
        `# has a decrease of 0. Rows are joined to the registry by the district names in\n` +
        `# ${record.names_from}.\n` +
        `#\n` +
        `# Do not hand-edit: re-run the import instead, so the record always matches the\n` +
        `# hashed artifact.`,
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
