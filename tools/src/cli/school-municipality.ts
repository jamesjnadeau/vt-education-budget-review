#!/usr/bin/env node
/**
 * Resolves each school's published coordinates to the municipality it stands in.
 *
 *   npm run school:municipality              resolve every school with coordinates
 *   npm run school:municipality -- --limit 5 a small run, for checking the shape
 *
 * WHY THIS EXISTS RATHER THAN A ONE-LINE JOIN
 *
 * The AOE API publishes a MailingCity for every school, and it is right there in
 * the response. It is a POSTAL designation: Vermont post office names routinely
 * cover parts of several towns, so a school in one town frequently carries
 * another town's mailing address. The sparse screen tests the density of the
 * municipality the BUILDING stands in, and a school in a dense town inside an
 * otherwise sparse district does not pass it -- so a mailing city wired into
 * that field would put a plausible wrong town behind a statutory test, in the
 * direction nobody would check.
 *
 * So the municipality is resolved by point-in-polygon: the school's published
 * coordinates against the Census Bureau's county subdivisions. The output is a
 * committed derived product with a `kind: derived` provenance record naming the
 * algorithm, its version, the pinned inputs and the run, because the answer to
 * "why does this say Marshfield?" has to be "here is the coordinate, the
 * benchmark, and the run -- re-run it yourself".
 *
 * The coordinates themselves are AOE's, published with no statement of how they
 * were derived. That limitation is recorded per record rather than papered over:
 * a rooftop coordinate and a driveway coordinate resolve to the same town almost
 * always, and "almost always" is worth writing down.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { PATHS, REPO_ROOT, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import type { RegistryEntity } from '../registry/types.ts';

const ALGORITHM = 'geocode/school-municipality';
const ALGORITHM_VERSION = '1.0.0';

/**
 * Pinned, not "Current".
 *
 * The geocoder's `Current_Current` vintage moves under you: the same coordinate
 * can resolve to a different boundary vintage next month, and a derived record
 * that cannot be reproduced is not provenance. These two strings are the pin.
 */
const BENCHMARK = 'Public_AR_Census2020';
const VINTAGE = 'Census2020_Census2020';
const GEOCODER = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';

const OUTPUT_DIR = join(REPO_ROOT, 'derived', 'school-municipality');
const OUTPUT_FILE = 'vt-school-municipality.yaml';
const CENSUS_RECORD = join(PATHS.warehouse, 'census', 'vt-town-land-and-population.yaml');
const CONCURRENCY = 4;

/**
 * Git's own blob hash for a file, computed without shelling out.
 *
 * Recorded rather than a plain content hash so the pin is the identifier git
 * will use for the same bytes -- `git cat-file -p <sha>` returns exactly the
 * input this run saw, whether or not it was committed at the time. A pin that
 * only makes sense inside this tool is not much of a pin.
 */
function gitBlobSha(path: string): string {
  const content = readFileSync(path);
  return createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${content.byteLength}\0`), content]))
    .digest('hex');
}

interface Resolved {
  readonly school: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly geoid: string | null;
  readonly census_name: string | null;
  readonly municipality: string | null;
  readonly note: string | null;
}

async function resolveOne(school: RegistryEntity): Promise<{ geoid: string; name: string } | null> {
  const url =
    `${GEOCODER}?x=${school.longitude}&y=${school.latitude}` +
    `&benchmark=${BENCHMARK}&vintage=${VINTAGE}&layers=County%20Subdivisions&format=json`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        result?: { geographies?: Record<string, Array<{ GEOID?: string; NAME?: string }>> };
      };
      const hit = body.result?.geographies?.['County Subdivisions']?.[0];
      if (!hit?.GEOID) return null;
      return { geoid: hit.GEOID, name: hit.NAME ?? '' };
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return null;
}

/** Runs the resolutions a few at a time. Courtesy, not throughput. */
async function resolveAll(schools: readonly RegistryEntity[]): Promise<Map<string, { geoid: string; name: string } | null>> {
  const out = new Map<string, { geoid: string; name: string } | null>();
  const queue = [...schools];
  let done = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const school = queue.shift();
      if (!school) return;
      out.set(school.slug, await resolveOne(school));
      done++;
      if (done % 25 === 0) console.log(`  ${done}/${schools.length}`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

async function main(): Promise<number> {
  const limitAt = process.argv.indexOf('--limit');
  const limit = limitAt === -1 ? Infinity : Number(process.argv[limitAt + 1]);

  const registry = readRegistry();

  // Every school-shaped entity, not only public ones. Independents and tech
  // centres are receiving schools in consolidation scenarios and appear in the
  // tuitioning limb of the necessity criteria, so their location matters even
  // though they are not grant candidates.
  const schools = [...registry.values()]
    .filter((e) => ['school', 'academy', 'techcenter', 'independent'].includes(e.type))
    .filter((e) => !e.effective_to)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const withCoordinates = schools.filter((s) => s.latitude !== null && s.longitude !== null);
  const withoutCoordinates = schools.filter((s) => s.latitude === null || s.longitude === null);
  const targets = withCoordinates.slice(0, limit);

  // GEOID is the join key, because names collide and change. The census import
  // already resolved every GEOID it could to a registry town, so this reuses
  // that decision rather than making a second, possibly different one.
  const census = parseYaml(readFileSync(CENSUS_RECORD, 'utf8')) as {
    towns: Array<{ entity: string | null; geoid: string; name_as_published: string }>;
  };
  const townByGeoid = new Map(census.towns.map((t) => [t.geoid, t]));

  console.log(
    `Resolving ${targets.length} school locations against Census county subdivisions ` +
      `(benchmark ${BENCHMARK}, vintage ${VINTAGE}).`,
  );
  const resolutions = await resolveAll(targets);

  const records: Resolved[] = targets.map((school) => {
    const hit = resolutions.get(school.slug) ?? null;
    const town = hit ? townByGeoid.get(hit.geoid) : undefined;

    return {
      school: school.slug,
      latitude: school.latitude as number,
      longitude: school.longitude as number,
      geoid: hit?.geoid ?? null,
      census_name: hit?.name ?? null,
      municipality: town?.entity ?? null,
      note: hit
        ? town?.entity
          ? null
          : `The coordinates fall in "${hit.name}" (GEOID ${hit.geoid}), which the census import ` +
            `could not join to a registry town. Resolve that join first; this record is not the ` +
            `place to make a second, possibly different decision about it.`
        : 'The Census geocoder returned no county subdivision for these coordinates.',
    };
  });

  const resolved = records.filter((r) => r.municipality !== null);

  const payload = {
    schema_version: '1.0',
    algorithm: ALGORITHM,
    algorithm_version: ALGORITHM_VERSION,
    basis: 'census_geocoder_point_in_polygon',
    note:
      'The municipality a school BUILDING stands in, resolved from AOE-published coordinates ' +
      'against Census county subdivisions. NOT derived from MailingCity: a postal city is not a ' +
      'municipality, and Vermont post office names routinely cover parts of several towns. ' +
      'The coordinates are AOE’s and carry no statement of precision, which is why the registry ' +
      'records geocode_precision as unknown and the distance criterion declines at that precision. ' +
      'Town assignment is far more forgiving of an imprecise coordinate than a ten-mile distance ' +
      'threshold is, but a school near a town line is the case to check by hand.',
    schools: records,
    schools_without_coordinates: withoutCoordinates.map((s) => s.slug),
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const body = stringifyYaml(payload);
  writeFileSync(join(OUTPUT_DIR, OUTPUT_FILE), body, 'utf8');

  const runId = `${new Date().toISOString()}/${createHash('sha256').update(body).digest('hex').slice(0, 6)}`;

  writeFileSync(
    join(OUTPUT_DIR, 'provenance.yaml'),
    stringifyYaml({
      schema_version: '1.0',
      kind: 'derived',
      entity: 'source/vt-budget-pipeline',
      derivation: {
        algorithm: ALGORITHM,
        algorithm_version: ALGORITHM_VERSION,
        engine: `US Census Bureau Geocoder, ${GEOCODER}`,
        inputs: [
          {
            ref: 'registry/entities/school.json',
            pinned_by: 'git_sha',
            pin: gitBlobSha(join(PATHS.registryEntities, 'school.json')),
            note:
              'Git blob hash of the registry file this run read, computed over the working ' +
              'tree rather than over HEAD -- so the pin identifies the bytes that were actually ' +
              'used, including on a run made before the registry was committed.',
          },
          {
            ref: rel(CENSUS_RECORD),
            pinned_by: 'sha256',
            pin: createHash('sha256').update(readFileSync(CENSUS_RECORD)).digest('hex'),
            note: 'Supplies the GEOID-to-registry-town join, so this run does not make a second one.',
          },
        ],
        parameters: { benchmark: BENCHMARK, vintage: VINTAGE, layers: 'County Subdivisions' },
        run_id: runId,
        run_by: 'npm run school:municipality',
        output_file: OUTPUT_FILE,
        output_sha256: createHash('sha256').update(body).digest('hex'),
        note:
          'Re-runnable: same coordinates, same pinned benchmark and vintage, same answer. The ' +
          'benchmark is pinned rather than set to Current because the current vintage moves, and ' +
          'a derived record that cannot be reproduced is not provenance.',
      },
    }),
    'utf8',
  );

  console.log(`\nWrote ${rel(join(OUTPUT_DIR, OUTPUT_FILE))}`);
  console.log(`  ${resolved.length} of ${targets.length} schools resolved to a registry town`);
  console.log(`  ${withoutCoordinates.length} schools have no published coordinates`);
  for (const record of records.filter((r) => r.municipality === null)) {
    console.log(`      ${record.school}: ${record.note}`);
  }
  return 0;
}

process.exit(await main());
