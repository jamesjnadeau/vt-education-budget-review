/**
 * The five-way taxonomy an AOE town row can fall into, and which classes earn
 * Vermont ADM.
 *
 * This exists because `operated_by: null` is ambiguous. 60 of 268 registry towns
 * have it, and they include Burlington, Rutland City, South Burlington,
 * Winooski, Springfield, St Johnsbury, Colchester, Milton, Hartford and Stowe --
 * towns that ARE districts, not towns without one. Grouping by operated_by alone
 * would silently drop them.
 *
 * NOTE ON `own_district`: that a town with a supervisory union but no separate
 * operating district is its own district is inferred from SU015 Burlington
 * Supervisory District and from Burlington High School carrying
 * `op: town/burlington`. It is recorded here as the working rule and has NOT
 * been confirmed against AOE's organizations data or the statute. Do not read
 * it as established fact. The conservation invariant in the next task's
 * aggregation step is what stops a wrong answer here from being a silent one.
 */

import { isReportingBucket } from '../../registry/placeholder.ts';
import type { RegistryEntity } from '../../registry/types.ts';

export type TownClass =
  | 'union_district_member'
  | 'own_district'
  | 'no_operating_district'
  | 'out_of_state_member'
  | 'residency_bucket';

export function classifyTown(entity: RegistryEntity): TownClass {
  // Bucket-ness is checked first so a 900-range record or UNKNOWN never falls
  // through to another class on account of some other field it happens to carry.
  if (entity.reporting_only || isReportingBucket({ id: entity.aoe_org_id ?? null, name: entity.name })) {
    return 'residency_bucket';
  }
  // Orford NH is a real town and a real member of the Rivendell Interstate
  // district. Its pupils are New Hampshire's, so it earns no Vermont ADM, but it
  // is emphatically not a bucket and must never be dropped from the registry.
  if (entity.aoe_org_id === 'T999') return 'out_of_state_member';
  if (entity.operated_by) return 'union_district_member';
  if (entity.supervisory_union) return 'own_district';
  return 'no_operating_district';
}

/** Only Vermont districts receive Vermont ADM. */
export function earnsVermontAdm(cls: TownClass): boolean {
  return cls === 'union_district_member' || cls === 'own_district';
}
