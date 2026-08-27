#!/usr/bin/env node
/**
 * Checks the built site for Section 508 conformance.
 *
 *   npm run a11y                          every page in site/dist
 *   npm run a11y -- site/dist/index.html  named pages only
 *
 * Requires a build first (`npm run build:data && npm run build:site`), because
 * it reads the HTML that actually ships rather than the templates that produce
 * it. A missing `site/dist` is a hard error, not a skip: a check that passes
 * because it found nothing to check is the failure mode this is here to avoid.
 *
 * Errors block, warnings are printed loudly and do not -- the same split
 * `npm run validate` uses, and for the same reason. See
 * `tools/src/a11y/section508.ts` for which failures land in which tier.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  CHECKED_TAGS,
  checkPage,
  formatFinding,
  RULES_NEEDING_A_RENDERER,
  summarize,
  type A11yFinding,
  type PageReport,
} from '../a11y/section508.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';

const USAGE = 'usage: npm run a11y [-- <page.html> ...]';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('-'));
  if (flags.length > 0) {
    // No options are supported. Saying so beats accepting a misspelled flag
    // and quietly checking the whole site instead of the page asked for.
    console.error(`unrecognized option(s): ${flags.join(' ')}\n${USAGE}`);
    return 1;
  }

  let pages: string[];
  if (args.length > 0) {
    pages = args.map((p) => resolve(p));
    const missing = pages.filter((p) => !existsSync(p));
    if (missing.length > 0) {
      console.error(`No such page(s):\n${missing.map((p) => `  ${rel(p)}`).join('\n')}`);
      return 1;
    }
  } else {
    if (!existsSync(PATHS.siteDist)) {
      console.error(
        `${rel(PATHS.siteDist)} does not exist. Build the site first:\n` +
          '  npm run build:data && npm run build:site',
      );
      return 1;
    }
    pages = walkFiles(PATHS.siteDist, (name) => name.endsWith('.html'));
    if (pages.length === 0) {
      console.error(`${rel(PATHS.siteDist)} contains no HTML. Is the build complete?`);
      return 1;
    }
  }

  const reports: PageReport[] = [];
  for (const page of pages) {
    reports.push(await checkPage(await readFile(page, 'utf8'), rel(page)));
  }

  // --- report -------------------------------------------------------------
  const { pages: checked, errors, warnings, notEvaluated } = summarize(reports);
  console.log(
    `Checked ${checked} page(s) for Section 508 conformance ` +
      `(axe-core rules tagged ${CHECKED_TAGS.join(', ')}).`,
  );

  const findings = reports.flatMap((r) => r.violations);
  const print = (label: string, list: A11yFinding[]): void => {
    if (list.length === 0) return;
    console.log(`\n${list.length} ${label}:`);
    for (const f of list) console.log(formatFinding(f));
  };

  const review = reports.filter((r) => r.needsReview.length > 0);
  if (review.length > 0) {
    console.log(`\n${review.length} page(s) with rules a person still has to decide:`);
    for (const r of review) console.log(`  ${r.page}: ${r.needsReview.join(', ')}`);
  }

  print(
    'WCAG 2.1 warning(s) -- not required by Section 508 today, required by the ADA Title II rule',
    findings.filter((f) => f.severity === 'warning'),
  );
  print('Section 508 error(s)', findings.filter((f) => f.severity === 'error'));

  if (notEvaluated.length > 0) {
    console.log(
      `\nNot checked here: ${notEvaluated.join(', ')}. ` +
        'These rules need a browser that lays the page out and computes colors, ' +
        'which this checker does not have. Verify them by hand.',
    );
  } else if (RULES_NEEDING_A_RENDERER.length > 0) {
    // The renderer-dependent rules did not even report as undecided, which
    // means axe never reached them -- a changed rule set or a page with no
    // text at all. Worth saying, because their silence otherwise reads as a
    // clean bill of health on contrast.
    console.log(
      `\nNote: ${RULES_NEEDING_A_RENDERER.join(', ')} did not run on any page. ` +
        'Contrast has not been checked.',
    );
  }

  console.log(`\n${errors} error(s), ${warnings} warning(s).`);
  console.log(
    'Automated checks find roughly a third of real accessibility barriers. ' +
      'See docs/accessibility.md for what still has to be checked by hand.',
  );
  return errors > 0 ? 1 : 0;
}

process.exit(await main());
