#!/usr/bin/env node
/**
 * The corrections register, in the two forms it leaves the repo in.
 *
 *   npm run registry:corrections               list the open set on stdout
 *   npm run registry:corrections -- --report   write the markdown email body
 *   npm run registry:corrections -- --csv      write the CSV
 *
 * Both outputs go to derived/corrections/. They are products of a computation
 * over committed inputs, which is what derived/ is for -- but they are written
 * as .md and .csv, so the validator's derived-provenance rule (which walks
 * .yaml) correctly leaves them alone. They are correspondence, not a data
 * product other code reads.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATHS, rel } from '../paths.ts';
import { readCorrections } from '../registry/corrections.ts';
import { buildCsv, buildReport, reportRows } from '../registry/corrections-report.ts';
import { readRegistry } from '../registry/store.ts';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function main(): number {
  const argv = process.argv.slice(2);
  const wantReport = argv.includes('--report');
  const wantCsv = argv.includes('--csv');

  const registry = readRegistry();
  if (registry.size === 0) {
    console.error('The registry is empty. Run `npm run registry:sync` first.');
    return 1;
  }

  // A malformed register (bad top-level shape, an unrecognized key) is a
  // contributor's typo, not a code path this CLI should model -- readCorrections
  // already explains exactly what is wrong and where. Printing that message and
  // exiting is friendlier than an unhandled stack trace, without pretending the
  // register was readable when it was not.
  let corrections;
  try {
    ({ corrections } = readCorrections());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const rows = reportRows(corrections, registry);
  const date = today();

  console.log(
    `${corrections.length} correction(s) in ${rel(PATHS.corrections)}; ` +
      `${rows.length} open with AOE.`,
  );
  for (const r of rows) {
    console.log(`  ${r.org_id} ${r.field_name}: ${r.old_value} -> ${r.new_value}`);
  }

  if (!wantReport && !wantCsv) return 0;

  mkdirSync(PATHS.derivedCorrections, { recursive: true });

  if (wantReport) {
    const path = join(PATHS.derivedCorrections, `report-${date}.md`);
    writeFileSync(path, buildReport(corrections, registry, date), 'utf8');
    console.log(`\nWrote ${rel(path)}`);
  }

  if (wantCsv) {
    const path = join(PATHS.derivedCorrections, `corrections-${date}.csv`);
    writeFileSync(path, buildCsv(corrections, registry), 'utf8');
    console.log(`Wrote ${rel(path)}`);
  }

  return 0;
}

process.exit(main());
