#!/usr/bin/env node
/**
 * Imports Census land area, and population where a key allows it.
 *
 *   npm run census:import                fetch, hash into intake/, build the warehouse record
 *   npm run census:import -- --from-intake   rebuild from the held artifact, no network
 *
 * These are the two inputs to the sparse screen: persons, and square miles of
 * land. They come from different Census products with different vintages, so
 * they are held as separate fields with separate provenance and divided only in
 * the engine, where the division can be shown.
 *
 * ON POPULATION AND THE MISSING KEY
 *
 * The Gazetteer files are open. The Census data API is not: county-subdivision
 * queries return a "Missing Key" page to an unauthenticated client, and this
 * project holds no key. So a default run lands land area alone and writes a
 * not_published entry saying exactly that, with the date. The density screen
 * then reports population as missing input rather than dividing by a number
 * nobody retrieved.
 *
 * Set CENSUS_API_KEY to fetch the population series as well. The key is
 * free from api.census.gov/data/key_signup.html. It is read from the
 * environment and never written to the repository -- what gets committed is the
 * response and its hash, not the credential that fetched it.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

import { joinToRegistry, parseGazetteer } from '../census/gazetteer.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';

/**
 * Pinned by vintage, not by "latest".
 *
 * Boundaries move and areas are restated. A figure whose vintage is "whatever
 * was current the day someone ran this" cannot be compared to next year's, and
 * cannot be defended when a town disputes its density.
 */
const GAZETTEER_VINTAGE = '2023';
const GAZETTEER_FILE = `${GAZETTEER_VINTAGE}_gaz_cousubs_50.txt`;
const GAZETTEER_URL =
  `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${GAZETTEER_VINTAGE}_Gazetteer/${GAZETTEER_FILE}`;
const INTAKE_DIR = join(PATHS.intake, 'census', `fy${GAZETTEER_VINTAGE}`);
const WAREHOUSE_FILE = join(PATHS.warehouse, 'census', 'vt-town-land-and-population.yaml');

const POPULATION_SOURCES = [
  {
    series: 'decennial_2020' as const,
    dataset: 'https://api.census.gov/data/2020/dec/pl',
    variable: 'P1_001N',
    vintage: '2020 Decennial Census, P.L. 94-171 redistricting file',
  },
  {
    series: 'acs_5yr' as const,
    dataset: 'https://api.census.gov/data/2023/acs/acs5',
    variable: 'B01003_001E',
    vintage: '2019-2023 American Community Survey 5-year estimates',
  },
];

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchGazetteer(): Promise<Buffer> {
  const response = await fetch(GAZETTEER_URL);
  if (!response.ok) {
    throw new Error(`${GAZETTEER_URL} returned HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Population by county subdivision, keyed by GEOID.
 *
 * Returns null rather than throwing when there is no key, because a run without
 * population is a legitimate, honest run -- it just produces a record that says
 * so.
 */
async function fetchPopulation(
  source: (typeof POPULATION_SOURCES)[number],
  key: string,
): Promise<Map<string, number> | null> {
  const url =
    `${source.dataset}?get=NAME,${source.variable}&for=county+subdivision:*&in=state:50&key=${key}`;
  const response = await fetch(url);
  const text = await response.text();

  // The API answers a keyless or bad-key request with an HTML page and HTTP
  // 200, so the status alone proves nothing.
  if (!text.trimStart().startsWith('[')) {
    console.error(
      `  ${source.series}: the API did not return JSON. This is what a missing or rejected ` +
        `key looks like -- it answers with an HTML page and HTTP 200, so the status code is ` +
        `no help. Population is left unretrieved and the record says so.`,
    );
    return null;
  }

  const rows = JSON.parse(text) as string[][];
  const header = rows[0] as string[];
  const valueAt = header.indexOf(source.variable);
  const stateAt = header.indexOf('state');
  const countyAt = header.indexOf('county');
  const subAt = header.indexOf('county subdivision');

  const out = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const geoid = `${row[stateAt]}${row[countyAt]}${row[subAt]}`;
    const value = Number(row[valueAt]);
    if (Number.isFinite(value)) out.set(geoid, value);
  }
  return out;
}

async function main(): Promise<number> {
  const fromIntake = process.argv.includes('--from-intake');
  const today = new Date().toISOString().slice(0, 10);
  const artifactPath = join(INTAKE_DIR, GAZETTEER_FILE);

  let raw: Buffer;
  if (fromIntake) {
    if (!existsSync(artifactPath)) {
      console.error(`No held artifact at ${rel(artifactPath)}. Run without --from-intake first.`);
      return 1;
    }
    raw = readFileSync(artifactPath);
    console.log(`Rebuilding from ${rel(artifactPath)} (no network).`);
  } else {
    console.log(`Fetching ${GAZETTEER_URL}`);
    raw = await fetchGazetteer();
    mkdirSync(INTAKE_DIR, { recursive: true });

    // Raw intake is sacred: written exactly as released, and if it is already
    // held and differs, that is a finding rather than something to overwrite.
    if (existsSync(artifactPath) && sha256(readFileSync(artifactPath)) !== sha256(raw)) {
      console.error(
        `${rel(artifactPath)} is already held and the Bureau is now serving different bytes. ` +
          `Raw artifacts are never edited. Work out what changed -- a restated area is a ` +
          `finding -- and land the new file under its own vintage rather than over this one.`,
      );
      return 1;
    }
    writeFileSync(artifactPath, raw);
  }

  const digest = sha256(raw);
  const rows = parseGazetteer(raw.toString('utf8'));
  const registry = readRegistry();
  const joined = joinToRegistry(rows, registry);

  // --- population, if a key is available ----------------------------------
  const key = process.env['CENSUS_API_KEY'];
  const populations = new Map<string, Map<string, number>>();
  if (key && !fromIntake) {
    for (const source of POPULATION_SOURCES) {
      const series = await fetchPopulation(source, key);
      if (series) populations.set(source.series, series);
    }
  } else if (!key) {
    console.log(
      'CENSUS_API_KEY is not set, so no population series was retrieved. Land area only.',
    );
  }

  const held = [...populations.keys()];

  // --- provenance ---------------------------------------------------------
  writeFileSync(
    join(INTAKE_DIR, 'provenance.yaml'),
    stringifyYaml({
      schema_version: '1.0',
      kind: 'sourced',
      entity: 'source/us-census-bureau',
      fiscal_year: Number(GAZETTEER_VINTAGE),
      artifacts: [
        {
          file: GAZETTEER_FILE,
          source_url: GAZETTEER_URL,
          retrieved_date: today,
          retrieval_method: 'http-fetch',
          sha256: digest,
          bytes: raw.byteLength,
          media_type: 'text/plain',
          retrieved_by: 'npm run census:import',
          document_type: 'other',
          note:
            `${GAZETTEER_VINTAGE} Gazetteer county subdivisions for Vermont. Supplies ALAND_SQMI, ` +
            `the denominator of the sparse screen. Land area is used and water area is not; the ` +
            `file carries both and the parser keeps them apart.`,
        },
      ],
    }),
    'utf8',
  );

  // --- warehouse record ---------------------------------------------------
  const record = {
    schema_version: '1.0',
    source: rel(artifactPath),
    area_measure: 'aland',
    area_vintage: `${GAZETTEER_VINTAGE} Census Gazetteer, county subdivisions`,
    population_series_held: held,
    population_sources: [...populations.keys()].map((series) => {
      const source = POPULATION_SOURCES.find((s) => s.series === series);
      return {
        series,
        dataset: source?.dataset ?? '',
        variable: source?.variable ?? '',
        vintage: source?.vintage ?? null,
        retrieved: today,
      };
    }),
    towns: joined.towns.map((t) => ({
      entity: t.entity,
      geoid: t.geoid,
      name_as_published: t.nameAsPublished,
      land_area_sq_mi: t.landAreaSqMi,
      water_area_sq_mi: t.waterAreaSqMi,
      population: {
        decennial_2020: populations.get('decennial_2020')?.get(t.geoid) ?? null,
        acs_5yr: populations.get('acs_5yr')?.get(t.geoid) ?? null,
        state_estimate: null,
      },
    })),
    not_published: [
      ...(held.includes('decennial_2020')
        ? []
        : [
            {
              path: 'towns.population.decennial_2020',
              reason:
                'The Census data API requires an API key for county-subdivision queries and none ' +
                'was supplied, so no population was retrieved. This is a fact about the run, not ' +
                'about the Bureau: set CENSUS_API_KEY and re-import. Until then the density screen ' +
                'reports population as missing rather than dividing by an estimate.',
              confirmed_by: 'npm run census:import',
              confirmed_date: today,
            },
          ]),
      ...(held.includes('acs_5yr')
        ? []
        : [
            {
              path: 'towns.population.acs_5yr',
              reason: 'Same: no API key was supplied, so the ACS series was not retrieved.',
              confirmed_by: 'npm run census:import',
              confirmed_date: today,
            },
          ]),
      {
        path: 'towns.population.state_estimate',
        reason:
          'Vermont publishes its own municipal population estimates, which are not fetched here. ' +
          'Whether the statute means a state estimate at all is unread -- see the parameter file ' +
          'structural_note on statutory.screens.sparse_density.population_series.',
        confirmed_by: 'npm run census:import',
        confirmed_date: today,
      },
    ],
    unmatched: joined.unmatched,
    extracted_by: 'npm run census:import',
    extracted_date: today,
  };

  mkdirSync(join(PATHS.warehouse, 'census'), { recursive: true });
  writeFileSync(
    WAREHOUSE_FILE,
    `# Census land area and population, by Vermont municipality.\n` +
      `#\n` +
      `# Transcribed from ${rel(artifactPath)} by npm run census:import. Do not hand-edit:\n` +
      `# re-run the import instead, so the record always matches the hashed artifact.\n` +
      `#\n` +
      `# LAND area, never total area. The file carries water area too, and nothing divides\n` +
      `# by it -- see model/goldens/small-sparse/land-versus-total-area.yaml for the fixture\n` +
      `# that fails if anyone swaps the measure.\n` +
      stringifyYaml(record),
    'utf8',
  );

  console.log(`\nWrote ${rel(WAREHOUSE_FILE)}`);
  console.log(`  ${record.towns.length} county subdivisions`);
  console.log(`  ${joined.towns.filter((t) => t.entity).length} joined to a registry town`);
  console.log(`  ${joined.unmatched.length} unmatched, listed in the record for a human to resolve`);
  console.log(`  ${joined.registryTownsWithoutArea.length} registry towns with no land area:`);
  for (const slug of joined.registryTownsWithoutArea) console.log(`      ${slug}`);
  console.log(
    `  population series held: ${held.length === 0 ? 'none (no CENSUS_API_KEY)' : held.join(', ')}`,
  );

  return 0;
}

process.exit(await main());
