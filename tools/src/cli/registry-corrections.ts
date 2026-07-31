#!/usr/bin/env node
/**
 * The corrections register, in the two forms it leaves the repo in.
 *
 *   npm run registry:corrections               list the open set on stdout
 *   npm run registry:corrections -- --report   write the markdown email body
 *   npm run registry:corrections -- --csv      write the CSV
 *   npm run registry:corrections -- --sent --to <email> [--note <text>] [--date <YYYY-MM-DD>]
 *                                              record that the open batch was sent to AOE
 *
 * --report and --csv are read-only producers: their outputs go to
 * derived/corrections/, products of a computation over committed inputs, which
 * is what derived/ is for -- but they are written as .md and .csv, so the
 * validator's derived-provenance rule (which walks .yaml) correctly leaves them
 * alone. They are correspondence, not a data product other code reads.
 *
 * --sent is the one MUTATING action: it rewrites registry/corrections.yaml,
 * flipping every open-and-outstanding claim to `sent` and stamping who received
 * the batch and when. It selects exactly the set --report would send (see
 * isOutstanding), so the two never disagree, and it leaves the change in the
 * working tree for a human to review and commit.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATHS, rel } from '../paths.ts';
import { isOutstanding, markSent, readCorrections } from '../registry/corrections.ts';
import type { Correction } from '../registry/corrections.ts';
import { buildCsv, buildReport, reportRows } from '../registry/corrections-report.ts';
import { readRegistry } from '../registry/store.ts';
import type { RegistryEntity } from '../registry/types.ts';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The value after a `--flag`, or null if the flag is absent or ends the argv. */
function flagValue(argv: readonly string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  if (i === -1 || i + 1 >= argv.length) return null;
  return argv[i + 1] ?? null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Records that the current open-and-outstanding batch was sent to AOE.
 *
 * The selection is `status: open` narrowed by isOutstanding -- the same
 * predicate --report uses -- so the batch stamped `sent` is exactly the batch a
 * freshly generated report would contain. `--to` is required because a sent
 * correction that does not name its recipient is a claim without a receipt, the
 * state checkCorrections now refuses. `--date` defaults to today for the common
 * case of marking sent the same day; it exists for the day-after case.
 */
function markOpenBatchSent(
  argv: readonly string[],
  corrections: readonly Correction[],
  registry: ReadonlyMap<string, RegistryEntity>,
): number {
  const recipient = flagValue(argv, '--to');
  if (recipient === null || !EMAIL.test(recipient)) {
    console.error(
      '`--sent` needs `--to <email>`: the AOE address the batch was sent to. ' +
        'A sent correction records who received it.',
    );
    return 1;
  }

  const sentDate = flagValue(argv, '--date') ?? today();
  if (!ISO_DATE.test(sentDate)) {
    console.error(`--date must be an ISO date (YYYY-MM-DD); got "${sentDate}".`);
    return 1;
  }

  const note = flagValue(argv, '--note');

  const toMark = corrections.filter((c) => c.status === 'open' && isOutstanding(c, registry));
  if (toMark.length === 0) {
    console.log('\nNo open corrections are outstanding with AOE; nothing to mark sent.');
    return 0;
  }

  const keys = new Set(toMark.map((c) => `${c.slug}#${c.field}`));
  const original = readFileSync(PATHS.corrections, 'utf8');
  const { text, marked } = markSent(original, keys, { sent_date: sentDate, recipient, note });
  writeFileSync(PATHS.corrections, text, 'utf8');

  console.log(`\nMarked ${marked.length} correction(s) sent to ${recipient} on ${sentDate}:`);
  for (const c of toMark) {
    const org = registry.get(c.slug);
    console.log(`  ${org?.aoe_org_id ?? c.slug} ${c.field}`);
  }
  console.log(`\nUpdated ${rel(PATHS.corrections)} -- review the diff and commit it.`);
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  const wantReport = argv.includes('--report');
  const wantCsv = argv.includes('--csv');
  const wantSent = argv.includes('--sent');

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

  if (wantSent) return markOpenBatchSent(argv, corrections, registry);

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
