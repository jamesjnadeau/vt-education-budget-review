/**
 * Resolve the AOE statutory-band ADM for a budget entity and fiscal year.
 *
 * The publication is keyed by operating district (a UD, or a town that runs its
 * own school). A budget record's entity is often the supervisory union, so an
 * SU is resolved by summing the statutory-band rollups of its member
 * district-like entities. Returns null when the year does not map to the
 * statutory bands or when the entity has no contributing AOE row -- the same
 * "unavailable, not zero" posture the rest of the ADM layer takes.
 */

import type { BandValues } from '@vt-budget/model';
import { STATUTORY_BANDS } from '@vt-budget/model';
import type { RegistryEntity } from './registry/types.ts';

interface AdmPublicationLike {
  readonly years: ReadonlyArray<{
    readonly fiscal_year: number;
    readonly maps_to_statutory_bands: boolean;
    readonly statutory_bands: Record<string, BandValues>;
  }>;
}

/** A UD, or a town that runs its own school. Mirrors grouping-budgets.isDistrictLike. */
function isDistrictLike(e: RegistryEntity): boolean {
  return e.type === 'ud' || (e.type === 'town' && !e.operated_by && !e.reporting_only);
}

function sumBands(rows: BandValues[]): BandValues {
  const out = Object.fromEntries(STATUTORY_BANDS.map((b) => [b, null])) as BandValues;
  for (const row of rows) {
    for (const band of STATUTORY_BANDS) {
      const v = row[band];
      if (v === null || v === undefined) continue;
      out[band] = Number(((out[band] ?? 0) + v).toFixed(2));
    }
  }
  return out;
}

export function aoeBandsFor(
  entity: string,
  fiscalYear: number,
  publication: AdmPublicationLike,
  registry: ReadonlyMap<string, RegistryEntity>,
): BandValues | null {
  const year = publication.years.find((y) => y.fiscal_year === fiscalYear);
  if (!year || !year.maps_to_statutory_bands) return null;

  const self = registry.get(entity);
  if (self && isDistrictLike(self)) {
    return year.statutory_bands[entity] ?? null;
  }

  // An SU (or any non-district-like entity): sum its district-like members.
  const rows: BandValues[] = [];
  for (const e of registry.values()) {
    if (e.supervisory_union === entity && isDistrictLike(e)) {
      const row = year.statutory_bands[e.slug];
      if (row) rows.push(row);
    }
  }
  return rows.length > 0 ? sumBands(rows) : null;
}
