/**
 * Reading and writing the registry and its raw snapshots.
 *
 * Two storage decisions worth stating, because both look odd until you think
 * about what git does with them.
 *
 * ONE FILE PER ENTITY TYPE, not per entity. ~900 entities as ~900 files would
 * give lovely per-entity blame and an unreviewable PR every time AOE touches
 * anything. Grouped by type, sorted by slug, pretty-printed one field per line,
 * a nightly sync produces a diff a human actually reads -- which is the entire
 * point of routing structural change through a PR.
 *
 * SNAPSHOTS ARE STORED UNCOMPRESSED, which is a deliberate deviation from the
 * plan's "(compressed)". Gzip embeds a timestamp, so an unchanged API response
 * compresses to different bytes every night and git stores a fresh blob each
 * time. Uncompressed, an unchanged response is byte-identical, hashes to the
 * same blob, and costs nothing at all to keep. Git also deltas and zlibs its
 * own objects, so the on-disk saving from pre-compressing was never real. The
 * cheap thing and the diffable thing are the same thing here.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATHS, rel } from '../paths.ts';
import { AOE_API_BASE, AOE_ENDPOINTS, type Snapshot } from './aoe-client.ts';
import type { EntityType, RegistryEntity, RegistryFile } from './types.ts';

const ENTITY_TYPES: readonly EntityType[] = [
  'su',
  'sd',
  'ud',
  'school',
  'town',
  'academy',
  'techcenter',
  'independent',
  'state',
];

const ENDPOINT_FOR_TYPE: Readonly<Record<EntityType, string>> = {
  su: AOE_ENDPOINTS.supervisoryUnions,
  sd: AOE_ENDPOINTS.organizations,
  ud: AOE_ENDPOINTS.unionDistricts,
  school: AOE_ENDPOINTS.publicSchools,
  town: AOE_ENDPOINTS.towns,
  academy: AOE_ENDPOINTS.independentSchools,
  techcenter: AOE_ENDPOINTS.organizations,
  independent: AOE_ENDPOINTS.independentSchools,
  state: AOE_ENDPOINTS.closedOrganizations,
};

export function readRegistry(): Map<string, RegistryEntity> {
  const registry = new Map<string, RegistryEntity>();
  if (!existsSync(PATHS.registryEntities)) return registry;

  for (const file of readdirSync(PATHS.registryEntities)) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(readFileSync(join(PATHS.registryEntities, file), 'utf8')) as RegistryFile;
    for (const record of parsed.records) registry.set(record.slug, record);
  }
  return registry;
}

export function writeRegistry(
  entities: readonly RegistryEntity[],
  meta: { readonly today: string; readonly snapshotPath: string | null },
): string[] {
  mkdirSync(PATHS.registryEntities, { recursive: true });
  const written: string[] = [];

  for (const type of ENTITY_TYPES) {
    const records = entities.filter((e) => e.type === type).sort((a, b) => a.slug.localeCompare(b.slug));
    if (records.length === 0) continue;

    const file: RegistryFile = {
      schema_version: '1.0',
      entity_type: type,
      synced_from: {
        api: AOE_API_BASE,
        endpoint: ENDPOINT_FOR_TYPE[type],
        last_synced: meta.today,
        snapshot: meta.snapshotPath,
      },
      records,
    };

    const path = join(PATHS.registryEntities, `${type}.json`);
    writeFileSync(path, JSON.stringify(file, null, 2) + '\n', 'utf8');
    written.push(rel(path));
  }

  return written;
}

/** Writes the raw API responses that this sync was built from. */
export function writeSnapshot(snapshot: Snapshot): string {
  const dir = join(PATHS.registryRaw, snapshot.date);
  mkdirSync(dir, { recursive: true });

  for (const [endpoint, records] of Object.entries(snapshot.endpoints)) {
    writeFileSync(join(dir, `${endpoint}.json`), JSON.stringify(records, null, 2) + '\n', 'utf8');
  }

  writeFileSync(
    join(dir, 'README.md'),
    `# AOE Public Data API snapshot, ${snapshot.date}\n\n` +
      `Raw responses exactly as returned, one file per endpoint. This is the provenance\n` +
      `record for the directory layer: the registry in \`registry/entities/\` is derived\n` +
      `from these files and can be rebuilt from them with \`npm run registry:sync -- --from ${snapshot.date}\`.\n\n` +
      `The site must be able to build from snapshots alone. The API is a convenience\n` +
      `layer, not a dependency.\n\n` +
      `| Endpoint | Records |\n|---|---|\n` +
      Object.entries(snapshot.endpoints)
        .map(([k, v]) => `| \`${k}\` | ${v.length} |`)
        .join('\n') +
      '\n',
    'utf8',
  );

  return rel(dir);
}

export function readSnapshot(date: string): Snapshot {
  const dir = join(PATHS.registryRaw, date);
  if (!existsSync(dir)) {
    throw new Error(`No snapshot at ${rel(dir)}.`);
  }
  const endpoints: Record<string, never[]> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    endpoints[file.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  }
  return { date, endpoints };
}

export function listSnapshots(): string[] {
  if (!existsSync(PATHS.registryRaw)) return [];
  return readdirSync(PATHS.registryRaw)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
}

/** Entities in force on a given date. Bitemporal queries go through here. */
export function activeOn(registry: ReadonlyMap<string, RegistryEntity>, date: string): RegistryEntity[] {
  return [...registry.values()].filter((e) => {
    if (e.effective_from && e.effective_from > date) return false;
    if (e.effective_to && e.effective_to < date) return false;
    return true;
  });
}
