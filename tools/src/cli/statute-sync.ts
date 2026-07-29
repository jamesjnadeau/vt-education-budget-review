#!/usr/bin/env node
/**
 * Snapshots the statute sections the parameter files cite.
 *
 *   npm run statute:sync
 *
 * This is to the parameter layer what registry/raw/ is to the directory layer:
 * the provenance record. When a parameter's `citation.quote` is challenged, the
 * text it was read from is in the repository, dated, and diffable against the
 * next time the section is fetched -- so an amendment shows up as a diff rather
 * than as a silently wrong number.
 *
 * See AGENT.md for why fetching these needs a repaired certificate chain.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, rel } from '../paths.ts';
import { fetchStatute } from '../statute/fetch.ts';

/** Sections cited by any parameter file. Keep in step with model/parameters/. */
const SECTIONS: ReadonlyArray<{ readonly cite: string; readonly url: string }> = [
  {
    cite: '16 V.S.A. § 4001',
    url: 'https://legislature.vermont.gov/statutes/section/16/133/04001',
  },
  {
    cite: '16 V.S.A. § 4010',
    url: 'https://legislature.vermont.gov/statutes/section/16/133/04010',
  },
  {
    cite: '16 V.S.A. § 4011',
    url: 'https://legislature.vermont.gov/statutes/section/16/133/04011',
  },
  {
    cite: '32 V.S.A. § 5401',
    url: 'https://legislature.vermont.gov/statutes/section/32/135/05401',
  },
  {
    cite: '32 V.S.A. § 5402',
    url: 'https://legislature.vermont.gov/statutes/section/32/135/05402',
  },
];

function fileNameFor(cite: string): string {
  return cite.replace(/\s+/g, '-').replace(/[§.]/g, '').replace(/-+/g, '-').toLowerCase() + '.txt';
}

async function main(): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(REPO_ROOT, 'model', 'statute', date);
  mkdirSync(dir, { recursive: true });

  let failures = 0;

  for (const section of SECTIONS) {
    try {
      const page = await fetchStatute(section.url);
      if (page.status !== 200) {
        console.error(`  ! ${section.cite}: HTTP ${page.status}`);
        failures++;
        continue;
      }
      const path = join(dir, fileNameFor(section.cite));
      writeFileSync(
        path,
        `CITATION: ${section.cite}\n` +
          `SOURCE:   ${section.url}\n` +
          `RETRIEVED:${page.retrieved}\n` +
          `HTTP:     ${page.status}\n` +
          `\n` +
          `Verbatim text as published by the Vermont General Assembly. This file is the\n` +
          `provenance record for every parameter citing this section. Do not edit it.\n` +
          `${'-'.repeat(76)}\n\n${page.text}\n`,
        'utf8',
      );
      console.log(`  ${section.cite} -> ${rel(path)} (${page.text.length} chars)`);
    } catch (error) {
      console.error(`  ! ${section.cite}: ${error instanceof Error ? error.message : String(error)}`);
      failures++;
    }
  }

  console.log(`\nSnapshot written to ${rel(dir)}`);
  if (failures > 0) {
    console.error(
      `${failures} section(s) failed. Do NOT weaken TLS verification to work around this ` +
        `-- fetch by hand and paste the text in. See AGENT.md.`,
    );
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
