#!/usr/bin/env node
/**
 * Imports the Vermont Department of Taxes FY2026 education property tax rate
 * table, keeping the per-town common level of appraisal (CLA).
 *
 *   npm run tax-rates:import              write warehouse/tax-rates/fy2026.yaml
 *   npm run tax-rates:import -- --check   parse and report, write nothing
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { readSheetRows } from '../aoe/adm/xlsx.ts';
import { PATHS, rel } from '../paths.ts';
import { parseTaxRates } from '../tax-rates/parse.ts';

const FILE = join(PATHS.intake, 'tax-rates', 'fy2026', 'FY26EdTaxRates_081825.xlsx');
const OUT = join(PATHS.warehouse, 'tax-rates', 'fy2026.yaml');

interface ProvenanceArtifact {
  readonly file?: string;
  readonly sha256?: string;
}

function verifiedHash(file: string): string {
  const provenance = join(dirname(file), 'provenance.yaml');
  const data = existsSync(provenance)
    ? (parseYaml(readFileSync(provenance, 'utf8')) as { artifacts?: ProvenanceArtifact[] })
    : {};
  const entry = data.artifacts?.find((a) => a.file === basename(file));
  if (!entry?.sha256) {
    throw new Error(`${rel(file)} has no provenance entry with a sha256. Record the artifact first.`);
  }
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (entry.sha256 !== actual) {
    throw new Error(
      `${rel(file)} does not match the sha256 in its provenance. A raw artifact is never ` +
        `edited, so a mismatch means the file changed after it was recorded.`,
    );
  }
  return actual;
}

async function main(): Promise<number> {
  const check = process.argv.slice(2).includes('--check');
  const sha256 = verifiedHash(FILE);
  const towns = parseTaxRates(await readSheetRows(FILE));
  const names = towns.map((t) => t.town);
  if (new Set(names).size !== names.length) {
    throw new Error(`${rel(FILE)} lists a town more than once`);
  }
  console.log(`${rel(FILE)}: ${towns.length} town(s)`);
  if (check) return 0;

  const record = {
    fiscal_year: 2026,
    source: rel(FILE),
    sha256,
    towns: towns.map(({ town, ...rest }) => ({ town, ...rest })),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    `# FY2026 per-town common level of appraisal (CLA) and education tax rates.\n` +
      `#\n` +
      `# Transcribed from ${rel(FILE)}\n` +
      `# by npm run tax-rates:import. Do not hand-edit: re-run the import instead, so the\n` +
      `# record always matches the hashed artifact.\n` +
      `#\n` +
      `# CLA is the fraction the sheet stores (0.6659 = 66.59%). Rates are per $100.\n` +
      stringifyYaml(record, { lineWidth: 88 }),
    'utf8',
  );
  console.log(`  wrote ${rel(OUT)}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
