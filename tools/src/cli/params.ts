#!/usr/bin/env node
/**
 * Parameter file status.
 *
 *   npm run params                  status of every parameter file
 *   npm run params -- --stale 400   citations verified more than N days ago
 *
 * The stale check is the legislative-session checklist item made mechanical.
 * Vermont's education funding statutes have been amended in most recent
 * sessions, so a citation verified eighteen months ago is a citation that
 * needs re-reading, not a citation that is done.
 */

import { readFileSync } from 'node:fs';

import { parse as parseYaml } from 'yaml';

import { parseParameterSet, staleParameters, unverifiedParameters } from '@vt-budget/model';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';

function arg(name: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
}

function main(): number {
  const staleDays = arg('stale') ? Number(arg('stale')) : null;
  const files = walkFiles(PATHS.parameters, (n) => /^fy\d{4}\.yaml$/.test(n));

  if (files.length === 0) {
    console.log(`No parameter files in ${rel(PATHS.parameters)}.`);
    return 0;
  }

  let anyUnverified = false;

  for (const file of files) {
    const set = parseParameterSet(parseYaml(readFileSync(file, 'utf8')));
    const unverified = unverifiedParameters(set);
    const total = set.parameters.size;
    const contingent = [...set.parameters.values()].filter((p) => p.contingent);

    console.log(`\n${rel(file)}  —  FY${set.fiscal_year}  [${set.status}]`);
    console.log(`  ${total - unverified.length}/${total} verified, ${contingent.length} contingent`);

    if (unverified.length > 0) {
      anyUnverified = true;
      console.log(`\n  Unverified — the engine will not compute with these:`);
      for (const p of unverified) {
        console.log(`    ${p.key.padEnd(44)} ${p.citation.statute}`);
      }
    }

    if (staleDays !== null) {
      const stale = staleParameters(set, new Date(), staleDays);
      if (stale.length > 0) {
        console.log(`\n  Verified more than ${staleDays} days ago — re-read against current text:`);
        for (const p of stale) {
          console.log(`    ${p.key.padEnd(44)} verified ${p.citation.verified_date}`);
        }
      } else {
        console.log(`\n  No citations older than ${staleDays} days.`);
      }
    }
  }

  if (anyUnverified) {
    console.log(`\nSee docs/parameter-verification.md for the procedure.`);
  }

  // Unverified parameters are the expected state early on, not a build
  // failure. What must never happen is a file claiming to be verified while
  // an entry is not, and parseParameterSet already throws on that.
  return 0;
}

process.exit(main());
