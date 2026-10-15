#!/usr/bin/env node
/**
 * Imports the AOE records-request extract of ADM by town of residence with
 * subgroups (grade bands, English learners, free-or-reduced-lunch eligibility).
 *
 *   npm run adm:subgroups              write one warehouse record per school year
 *   npm run adm:subgroups -- --check   parse and report, write nothing
 *
 * The artifact arrived by email in answer to a records request, so there is no
 * retrieval step to automate. A person files it under intake/ with its
 * provenance; everything after that is deterministic.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { parseExtract } from '../aoe/adm-subgroups/parse.ts';
import { buildYear, schoolYears, type YearRecord } from '../aoe/adm-subgroups/record.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';

const INTAKE = join(PATHS.intake, 'aoe-adm-subgroups');
const WAREHOUSE = join(PATHS.warehouse, 'aoe-adm-subgroups');

interface ProvenanceArtifact {
  readonly file?: string;
  readonly retrieved_by?: string;
  readonly sha256?: string;
}

function provenanceArtifacts(dir: string): ProvenanceArtifact[] {
  const provenance = join(dir, 'provenance.yaml');
  if (!existsSync(provenance)) return [];
  const data = parseYaml(readFileSync(provenance, 'utf8')) as {
    artifacts?: ProvenanceArtifact[];
  };
  return data.artifacts ?? [];
}

function provenanceEntry(file: string): ProvenanceArtifact | null {
  return provenanceArtifacts(dirname(file)).find((a) => a.file === basename(file)) ?? null;
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Both the extract and the query it was produced with must match their recorded hashes. */
function verifyHash(file: string): void {
  const entry = provenanceEntry(file);
  if (!entry?.sha256) {
    throw new Error(
      `${rel(file)} has no provenance entry with a sha256. Record the artifact first.`,
    );
  }
  if (entry.sha256 !== sha256(file)) {
    throw new Error(
      `${rel(file)} does not match the sha256 in its provenance. A raw artifact is never ` +
        `edited, so a mismatch means the file changed after it was recorded.`,
    );
  }
}

function extractedBy(file: string): string {
  const entry = provenanceEntry(file);
  if (entry?.retrieved_by) return entry.retrieved_by;
  throw new Error(
    `${rel(file)} has no provenance entry naming who retrieved it. Every "not published" ` +
      `finding is recorded against a person, so the provenance must come first.`,
  );
}

/** The one SQL file beside the extract, which the disclosure codes follow. */
function methodFor(file: string): string {
  const sql = walkFiles(dirname(file), (n) => n.endsWith('.sql'));
  if (sql.length !== 1) {
    throw new Error(
      `Expected exactly one .sql method file beside ${rel(file)}, found ${sql.length}. ` +
        `The warehouse record cites the query its disclosure codes follow.`,
    );
  }
  return sql[0] as string;
}

function write(path: string, header: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  // Withheld cells share one bound object apiece; without this the stringifier
  // would emit hundreds of YAML aliases, which the parser then refuses as a
  // resource-exhaustion guard. Repeating the bound keeps the record greppable.
  writeFileSync(
    path,
    `${header}\n${stringifyYaml(data, { lineWidth: 88, aliasDuplicateObjects: false })}`,
    'utf8',
  );
  console.log(`  wrote ${rel(path)}`);
}

function summarize(record: YearRecord): string {
  const towns = record.towns;
  const below = towns.filter((t) => t.row_status === 'below_reporting_floor').length;
  const pairs = towns.reduce((n, t) => n + t.suppression_pairs.length, 0);
  const suppressedBands = towns.reduce(
    (n, t) => n + Object.values(t.bands).filter((c) => typeof c !== 'number').length,
    0,
  );
  return (
    `${towns.length} town row(s), ${record.unresolved_rows.length} unresolved, ` +
    `${below} below floor, ${suppressedBands} band cell(s) withheld (${pairs} pair(s)), ` +
    `measures: ${record.not_published.length === 0 ? 'ell + nslelg' : 'bands only'}` +
    `${record.preliminary ? ', PRELIMINARY' : ''}`
  );
}

async function main(): Promise<number> {
  const check = process.argv.slice(2).includes('--check');
  const files = walkFiles(INTAKE, (n) => /\.xlsx$/i.test(n));
  if (files.length !== 1) {
    console.error(
      `Expected exactly one extract under ${rel(INTAKE)}, found ${files.length}. ` +
        `A second delivery should supersede the first in provenance before it is imported.`,
    );
    return 1;
  }
  const file = files[0] as string;
  const method = methodFor(file);
  console.log(`\n${rel(file)}`);
  verifyHash(file);
  verifyHash(method);

  const extract = await parseExtract(file);
  console.log(`  ${extract.rows.length} row(s) across ${schoolYears(extract).join(', ')}`);

  const registry = readRegistry();
  const opts = {
    source: rel(file),
    method: rel(method),
    registry,
    extracted_by: extractedBy(file),
    extracted_date: new Date().toISOString().slice(0, 10),
  };

  for (const sy of schoolYears(extract)) {
    const record = buildYear(extract, sy, opts);
    console.log(`  ${sy}  FY${record.fiscal_year}  ${summarize(record)}`);
    if (check) continue;
    write(
      join(WAREHOUSE, `town-${sy.toLowerCase()}.yaml`),
      `# AOE average daily membership by town of residence, ${record.count_year} (${sy}),\n` +
        `# in Act 127 grade bands with English-learner and free-or-reduced-lunch counts.\n` +
        `#\n` +
        `# Transcribed from ${rel(file)}\n` +
        `# by npm run adm:subgroups. Do not hand-edit: re-run the import instead, so the\n` +
        `# record always matches the hashed artifact.\n` +
        `#\n` +
        `# AOE suppressed small cells before release. A withheld cell is recorded as the bound\n` +
        `# its disclosure code implies and nothing tighter; constraints between cells are\n` +
        `# written down and never solved. A town missing from this file had no resident\n` +
        `# students that year (the query emits a row for every town-year with at least one).`,
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
