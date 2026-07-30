#!/usr/bin/env node
/**
 * Imports AOE average daily membership reports.
 *
 *   npm run adm:import                 import every artifact in intake/aoe-adm
 *   npm run adm:import -- --check      parse and report, write nothing
 *   npm run adm:import -- --discover   list years the saved page snapshot offers
 *
 * Retrieval is not automated and cannot be: education.vermont.gov returns HTTP
 * 403 to every non-browser client, for page and direct file URLs alike, and
 * AGENT.md rules out working around it. A human downloads the files. Everything
 * after that is deterministic.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { aggregate } from '../aoe/adm/aggregate.ts';
import { discoverFromHtml } from '../aoe/adm/discover.ts';
import { buildGapRegister } from '../aoe/adm/gaps.ts';
import { joinRows } from '../aoe/adm/join.ts';
import { parseReport, type ParsedReport } from '../aoe/adm/parse.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';

const ADM_INTAKE = join(PATHS.intake, 'aoe-adm');
const ADM_WAREHOUSE = join(PATHS.warehouse, 'aoe-adm');

function artifacts(): string[] {
  if (!existsSync(ADM_INTAKE)) return [];
  return walkFiles(ADM_INTAKE, (n) => /\.xlsx?$/i.test(n)).sort();
}

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

/** The person recorded as having confirmed what the source does not publish. */
function extractedBy(file: string): string {
  const entry = provenanceEntry(file);
  if (entry?.retrieved_by) return entry.retrieved_by;
  throw new Error(
    `${rel(file)} has no provenance entry naming who retrieved it.\n\n` +
      `The import records a person against every "the source does not publish this" ` +
      `finding, so that a null always means the source was silent and never that nobody ` +
      `looked. Write ${rel(join(dirname(file), 'provenance.yaml'))} first.`,
  );
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function verifyHash(file: string): void {
  const entry = provenanceEntry(file);
  if (entry?.sha256 && entry.sha256 !== sha256(file)) {
    throw new Error(
      `${rel(file)} does not match the sha256 in its provenance. A raw artifact is never ` +
        `edited, so a mismatch means the file changed after it was recorded. Re-download ` +
        `it and record the new hash as a superseding artifact rather than overwriting.`,
    );
  }
}

function toRecord(file: string, parsed: ParsedReport): Record<string, unknown> {
  const registry = readRegistry();
  const joined = joinRows(parsed.rows, registry);
  const rollup = aggregate(joined, parsed.bands_as_published.length);
  const who = extractedBy(file);
  const today = new Date().toISOString().slice(0, 10);

  // Recorded per year, against the artifact, so the null is a finding.
  const notPublished = [
    {
      path: 'adm.prekindergarten',
      confirmed_by: who,
      confirmed_date: today,
      note:
        'The AOE resident-district report publishes no prekindergarten column. This is ' +
        'a confirmed absence in the source, not an unfilled field.',
    },
  ];

  return {
    schema_version: '1.0',
    source: rel(file),
    count_year: parsed.labels.count_year,
    adm_label: parsed.labels.adm_label,
    fiscal_year: parsed.labels.fiscal_year,
    source_title: parsed.labels.source_title,
    bands_as_published: parsed.bands_as_published,
    maps_to_statutory_bands: parsed.maps_to_statutory_bands,
    towns: joined.map((j) => ({
      entity: j.slug,
      aoe_org_id: j.row.aoe_org_id,
      name_as_published: j.row.name_as_published,
      town_class: j.town_class,
      values: j.row.values,
    })),
    band_totals: parsed.band_totals,
    grand_total: parsed.grand_total,
    not_published: notPublished,
    extracted_by: who,
    extracted_date: today,
    // Reported, not stored: the rollup is derived and must not be committed.
    _rollup_summary: {
      districts: rollup.districts.length,
      exclusions: rollup.exclusions.length,
    },
  };
}

function write(path: string, header: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${header}\n${stringifyYaml(data, { lineWidth: 88 })}`, 'utf8');
  console.log(`  wrote ${rel(path)}`);
}

function discover(): number {
  const snapshots = existsSync(ADM_INTAKE)
    ? walkFiles(ADM_INTAKE, (n) => n.endsWith('.html')).sort()
    : [];
  if (snapshots.length === 0) {
    console.error(
      `No saved page snapshot under ${rel(ADM_INTAKE)}.\n\n` +
        `The page cannot be fetched: education.vermont.gov returns 403 to every ` +
        `non-browser client. Save it from a browser as page-<date>.html.`,
    );
    return 1;
  }

  const latest = snapshots[snapshots.length - 1] as string;
  const found = discoverFromHtml(readFileSync(latest, 'utf8'));
  const held = new Set(artifacts().map((f) => basename(f)));

  console.log(`${found.length} ADM report(s) listed in ${rel(latest)}:\n`);
  for (const r of found) {
    const have = [...held].some((f) =>
      new RegExp(`(?:fy|adm)[-_]?${r.adm_label}(?!\\d)`, 'i').test(f),
    );
    console.log(`  ${have ? 'have' : 'MISSING'}  FY${r.fiscal_year}  SY${r.count_year}  ${r.url}`);
  }
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--discover')) return discover();

  const check = argv.includes('--check');
  const files = artifacts();
  if (files.length === 0) {
    console.error(
      `No ADM spreadsheets under ${rel(ADM_INTAKE)}.\n\n` +
        `Download them from the AOE page by hand -- the host refuses scripted clients -- ` +
        `into ${rel(ADM_INTAKE)}/fy<YEAR>/.`,
    );
    return 1;
  }

  const summaries: Array<{ fiscal_year: number; maps_to_statutory_bands: boolean }> = [];

  for (const file of files) {
    console.log(`\n${rel(file)}`);
    verifyHash(file);
    const parsed = await parseReport(file);
    console.log(
      `  FY${parsed.labels.fiscal_year}  SY${parsed.labels.count_year}  ` +
        `${parsed.rows.length} town(s)  ` +
        `bands ${parsed.bands_as_published.map((b) => b.header).join(' | ')}`,
    );
    console.log(
      `  totals ${parsed.band_totals.join(' / ')} = ${parsed.grand_total}` +
        `  ${
          parsed.maps_to_statutory_bands
            ? 'maps to § 4010 bands'
            : 'PRE-ACT-127 bands: not engine input'
        }`,
    );

    const record = toRecord(file, parsed);
    const summary = record['_rollup_summary'] as { districts: number; exclusions: number };
    console.log(`  ${summary.districts} district(s), ${summary.exclusions} exclusion(s)`);
    delete record['_rollup_summary'];

    summaries.push({
      fiscal_year: parsed.labels.fiscal_year,
      maps_to_statutory_bands: parsed.maps_to_statutory_bands,
    });

    if (!check) {
      write(
        join(ADM_WAREHOUSE, `adm${parsed.labels.adm_label}.yaml`),
        `# AOE average daily membership, ${parsed.labels.source_title}\n` +
          `#\n` +
          `# Transcribed from ${rel(file)} by npm run adm:import. Do not hand-edit:\n` +
          `# re-run the import instead, so the record always matches the hashed artifact.\n` +
          `#\n` +
          `# bands_as_published is verbatim and is never normalized. Act 127 changed the\n` +
          `# statutory grade bands effective July 1 2024, and a report's bands follow its\n` +
          `# determination year, so years either side of that boundary are not comparable\n` +
          `# band to band.`,
        record,
      );
    }
  }

  if (!check) {
    write(
      join(ADM_WAREHOUSE, 'gaps.yaml'),
      `# What 16 V.S.A. § 4010 needs that the AOE resident-district report does not\n` +
        `# supply. Generated by npm run adm:import. The site reads this so a null in the\n` +
        `# walkthrough can say why it is null.`,
      buildGapRegister(summaries),
    );
  }

  console.log(
    `\n${files.length} report(s) ${check ? 'checked' : 'imported'}. ` +
      `Engine-eligible years: ${
        summaries
          .filter((s) => s.maps_to_statutory_bands)
          .map((s) => s.fiscal_year)
          .join(', ') || 'none'
      }.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
