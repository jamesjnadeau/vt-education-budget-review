#!/usr/bin/env node
/**
 * Imports the Vermont Department of Taxes education property tax rate tables,
 * one workbook per fiscal year, keeping each town's common level of appraisal
 * (CLA) and rates.
 *
 *   npm run tax-rates:import                    every intake/tax-rates/fy<YEAR>/
 *   npm run tax-rates:import -- --year 2027     one year
 *   npm run tax-rates:import -- --check         parse and report, write nothing
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { readSheetRows } from '../aoe/adm/xlsx.ts';
import { PATHS, rel } from '../paths.ts';
import { parseTaxRates } from '../tax-rates/parse.ts';

const INTAKE = join(PATHS.intake, 'tax-rates');

/** The one workbook in each intake/tax-rates/fy<YEAR>/ folder, oldest year first. */
function workbooks(): Array<{ year: number; file: string }> {
  if (!existsSync(INTAKE)) return [];
  const out: Array<{ year: number; file: string }> = [];
  for (const dir of readdirSync(INTAKE).sort()) {
    const m = /^fy(\d{4})$/.exec(dir);
    if (!m) continue;
    const books = readdirSync(join(INTAKE, dir)).filter((n) => /\.xlsx$/i.test(n));
    if (books.length !== 1) {
      throw new Error(`${rel(join(INTAKE, dir))} holds ${books.length} workbooks; expected exactly one.`);
    }
    out.push({ year: Number(m[1]), file: join(INTAKE, dir, books[0] as string) });
  }
  return out;
}

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

async function importYear(year: number, file: string, check: boolean): Promise<void> {
  const out = join(PATHS.warehouse, 'tax-rates', `fy${year}.yaml`);
  const sha256 = verifiedHash(file);
  const towns = parseTaxRates(await readSheetRows(file));
  const names = towns.map((t) => t.town);
  if (new Set(names).size !== names.length) {
    throw new Error(`${rel(file)} lists a town more than once`);
  }
  const noRate = towns.filter((t) => t.homestead_rate === null).map((t) => t.town);
  console.log(
    `${rel(file)}: ${towns.length} town(s)` +
      (noRate.length > 0 ? `, no homestead rate for ${noRate.join(', ')}` : ''),
  );
  if (check) return;

  // Fields a year's layout does not have are left out rather than written as null.
  const record = {
    fiscal_year: year,
    source: rel(file),
    sha256,
    towns: towns.map((t) => {
      const { town, school_code, statewide_adjustment, cla_over_sa, ...rest } = t;
      return {
        town,
        ...(school_code === null ? {} : { school_code }),
        cla: rest.cla,
        ...(statewide_adjustment === null ? {} : { statewide_adjustment }),
        ...(cla_over_sa === null ? {} : { cla_over_sa }),
        district_rate: rest.district_rate,
        homestead_rate: rest.homestead_rate,
        nonhomestead_rate: rest.nonhomestead_rate,
      };
    }),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `# FY${year} per-town common level of appraisal (CLA) and education tax rates.\n` +
      `#\n` +
      `# Transcribed from ${rel(file)}\n` +
      `# by npm run tax-rates:import. Do not hand-edit: re-run the import instead, so the\n` +
      `# record always matches the hashed artifact.\n` +
      `#\n` +
      `# CLA is the fraction the sheet stores (0.6659 = 66.59%). Rates are per $100.\n` +
      stringifyYaml(record, { lineWidth: 88 }),
    'utf8',
  );
  console.log(`  wrote ${rel(out)}`);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const yearAt = argv.indexOf('--year');
  const only = yearAt >= 0 ? Number(argv[yearAt + 1]) : null;
  const books = workbooks().filter((b) => only === null || b.year === only);
  if (books.length === 0) {
    console.error(`No tax rate workbook found under ${rel(INTAKE)}${only === null ? '' : ` for FY${only}`}.`);
    return 1;
  }
  for (const b of books) await importYear(b.year, b.file, check);
  return 0;
}
main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
