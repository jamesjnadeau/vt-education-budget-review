#!/usr/bin/env node
/**
 * Collector configs and source liveness.
 *
 *   npm run collect -- --init         create a stub config for every active SU
 *   npm run collect -- --check-urls   weekly liveness check across all sources
 *   npm run collect                   report acquisition coverage
 *
 * The plan's judgement holds and this tool is built around it: for 52-odd
 * entities publishing one budget a year, manual acquisition costs a few hours
 * annually and no scraper generalizes. The automation that pays for itself is
 * DETECTION -- knowing a new budget exists, and knowing when a source URL dies
 * -- rather than retrieval.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readFileSync } from 'node:fs';

import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';

interface CollectorSource {
  url: string;
  kind: string;
  document_pattern: string | null;
  link_selector: string | null;
  last_checked: string | null;
  last_status: number | null;
}

interface CollectorConfig {
  schema_version: '1.0';
  entity: string;
  priority: number | null;
  sources: CollectorSource[];
  acquisition: {
    method: 'http-fetch' | 'scrape' | 'manual';
    detection: 'page_hash' | 'link_scan' | 'none';
    fiscal_years_available: number[];
    notes: string | null;
  };
  known_not_published: unknown[];
  contacts: unknown[];
}

/**
 * AOE publishes some websites without a scheme ("www.brsu.org"), which is not
 * a URI and which `fetch` cannot follow. Assume https and let the liveness
 * check record what actually happens.
 */
function normalizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function configPath(slug: string): string {
  return join(PATHS.collectors, slug.replace('/', '-'), 'config.yaml');
}

function init(): number {
  const registry = readRegistry();
  const activeSus = [...registry.values()]
    .filter((e) => e.type === 'su' && !e.effective_to)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  let created = 0;
  let skipped = 0;

  for (const su of activeSus) {
    const path = configPath(su.slug);
    if (existsSync(path)) {
      skipped++;
      continue;
    }

    const website = normalizeUrl(su.website);

    const sources: CollectorSource[] = website
      ? [
          {
            url: website,
            kind: 'other',
            // Deliberately not guessed. The SU homepage is where a human
            // starts looking; the actual budget page has to be found once, by
            // hand, and then recorded here forever.
            document_pattern: null,
            link_selector: null,
            last_checked: null,
            last_status: null,
          },
        ]
      : [];

    if (sources.length === 0) {
      console.log(`  ! ${su.slug} has no website in the registry; skipped.`);
      continue;
    }

    const config: CollectorConfig = {
      schema_version: '1.0',
      entity: su.slug,
      // Coverage order comes from the business plan's ranked warm list, not
      // from this tool. Left null so it is filled in deliberately.
      priority: null,
      sources,
      acquisition: {
        method: 'manual',
        detection: 'page_hash',
        fiscal_years_available: [],
        notes: null,
      },
      known_not_published: [],
      contacts: [],
    };

    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(
      path,
      `# Collector configuration for ${su.name}.\n` +
        `#\n` +
        `# Generated as a stub from the registry. The URL below is the SU's website as\n` +
        `# AOE publishes it, which is a starting point, not the budget page. To make this\n` +
        `# config useful:\n` +
        `#\n` +
        `#   - point 'url' at the page that actually lists budget documents\n` +
        `#   - set 'kind' to budget_page / annual_report_page / board_docs / town_page\n` +
        `#   - describe what to look for in 'document_pattern', in prose, for a human\n` +
        `#   - record the fiscal years you know exist\n` +
        `#   - put this SU's quirks in 'notes' -- that field is where knowledge stops\n` +
        `#     living only in one person's head\n` +
        `#   - set 'priority' from the warm list; coverage is sequenced by relationship\n` +
        `#     value, never alphabetically\n` +
        `\n` +
        stringifyYaml(config, { lineWidth: 88 }),
      'utf8',
    );
    created++;
  }

  console.log(`\nCreated ${created} collector config stub(s), skipped ${skipped} existing.`);
  console.log(`Configs live under ${rel(PATHS.collectors)}/<su-slug>/config.yaml`);
  return 0;
}

async function checkUrls(): Promise<number> {
  const files = walkFiles(PATHS.collectors, (n) => n === 'config.yaml');
  if (files.length === 0) {
    console.log('No collector configs. Run `npm run collect -- --init` first.');
    return 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  const dead: Array<{ entity: string; url: string; status: number | string }> = [];
  let checked = 0;

  for (const file of files) {
    const config = parseYaml(readFileSync(file, 'utf8')) as CollectorConfig;
    let changed = false;

    for (const source of config.sources) {
      checked++;
      let status: number | string;
      try {
        const response = await fetch(source.url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(20_000),
          headers: { 'user-agent': 'vt-budget-pipeline source liveness check' },
        });
        status = response.status;
      } catch (error) {
        status = error instanceof Error ? error.name : 'error';
      }

      source.last_checked = today;
      source.last_status = typeof status === 'number' ? status : null;
      changed = true;

      if (typeof status !== 'number' || status >= 400) {
        dead.push({ entity: config.entity, url: source.url, status });
        console.log(`  DEAD ${config.entity}  ${status}  ${source.url}`);
      }
    }

    if (changed) writeFileSync(file, stringifyYaml(config, { lineWidth: 88 }), 'utf8');
  }

  console.log(`\nChecked ${checked} source URL(s) across ${files.length} config(s). ${dead.length} dead.`);
  // Dead links open issues rather than failing the build -- a district
  // reorganizing its website is news, not a broken pipeline.
  return 0;
}

function report(): number {
  const files = walkFiles(PATHS.collectors, (n) => n === 'config.yaml');
  const registry = readRegistry();
  const activeSus = [...registry.values()].filter((e) => e.type === 'su' && !e.effective_to);

  const byMethod = new Map<string, number>();
  const configured = new Set<string>();

  for (const file of files) {
    const config = parseYaml(readFileSync(file, 'utf8')) as CollectorConfig;
    configured.add(config.entity);
    const m = config.acquisition.method;
    byMethod.set(m, (byMethod.get(m) ?? 0) + 1);
  }

  console.log(`${files.length} collector config(s) for ${activeSus.length} active supervisory unions.`);
  for (const [method, count] of [...byMethod].sort()) console.log(`  ${method}: ${count}`);

  const missing = activeSus.filter((su) => !configured.has(su.slug));
  if (missing.length > 0) {
    console.log(`\n${missing.length} active SU(s) without a collector config:`);
    for (const su of missing.slice(0, 20)) console.log(`  ${su.slug}`);
    if (missing.length > 20) console.log(`  … and ${missing.length - 20} more`);
  }
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--init')) return init();
  if (argv.includes('--check-urls')) return checkUrls();
  return report();
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
