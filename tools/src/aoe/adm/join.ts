/**
 * Resolves an AOE town code to a registry entity.
 *
 * The join is on `aoe_org_id` and nothing else. 15 of the 254 rows in a real
 * report carry a name that differs from the registry's -- "Alburg" for ALBURGH,
 * "Middlebury ID #4" for MIDDLEBURY, "St. Albans City" for ST ALBANS CITY -- so
 * a name-based join would silently drop real towns holding real pupils. The
 * published name is carried through for auditing and used for nothing else.
 */

import type { RegistryEntity } from '../../registry/types.ts';
import { classifyTown, type TownClass } from './classify.ts';
import type { AdmRow } from './parse.ts';

export interface JoinedRow {
  readonly row: AdmRow;
  readonly slug: string;
  readonly entity: RegistryEntity;
  readonly town_class: TownClass;
}

export function joinRows(
  rows: ReadonlyArray<AdmRow>,
  registry: ReadonlyMap<string, RegistryEntity>,
): ReadonlyArray<JoinedRow> {
  const byOrgId = new Map<string, RegistryEntity>();
  for (const entity of registry.values()) {
    if (entity.type === 'town' && entity.aoe_org_id) byOrgId.set(entity.aoe_org_id, entity);
  }

  const joined: JoinedRow[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    const entity = byOrgId.get(row.aoe_org_id);
    if (!entity) {
      unmatched.push(`${row.aoe_org_id} ("${row.name_as_published}")`);
      continue;
    }
    joined.push({ row, slug: entity.slug, entity, town_class: classifyTown(entity) });
  }

  if (unmatched.length > 0) {
    throw new Error(
      `${unmatched.length} ADM row(s) name a town code with no registry entity:\n` +
        unmatched.map((u) => `  ${u}`).join('\n') +
        `\n\nEvery row in every report opened so far joins cleanly, so an unmatched code ` +
        `means either a stale registry or a new AOE record. Run \`npm run registry:sync\` ` +
        `and look at what changed. Rows are never skipped: a dropped town is missing ` +
        `pupils, and missing pupils are indistinguishable from a town with none.`,
    );
  }

  return joined;
}
