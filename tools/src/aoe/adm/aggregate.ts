/**
 * Rolls town-level ADM up to districts, and refuses to lose a pupil doing it.
 *
 * AOE publishes by resident district (town); § 4010 weights a school district's
 * membership. The obvious rule -- group by `operated_by` -- silently drops the 60
 * towns whose `operated_by` is null, among them Burlington, Rutland City and
 * Winooski, which are districts rather than district members.
 *
 * The conservation invariant is the guard. Every town's pupils land either in a
 * district total or in an individually justified exclusion, and the two must add
 * back to the town-level total per band. A rollup that loses pupils fails loudly
 * instead of publishing a plausible, smaller number.
 */

import { earnsVermontAdm, type TownClass } from './classify.ts';
import type { JoinedRow } from './join.ts';

export interface Exclusion {
  readonly aoe_org_id: string;
  readonly slug: string;
  readonly name_as_published: string;
  readonly town_class: TownClass;
  readonly values: ReadonlyArray<number | null>;
  readonly total: number;
  readonly justification: string;
}

export interface DistrictTotal {
  readonly district: string;
  readonly member_towns: ReadonlyArray<string>;
  readonly values: ReadonlyArray<number | null>;
}

export interface Rollup {
  readonly districts: ReadonlyArray<DistrictTotal>;
  readonly exclusions: ReadonlyArray<Exclusion>;
  readonly town_band_totals: ReadonlyArray<number>;
  readonly district_band_totals: ReadonlyArray<number>;
  readonly excluded_band_totals: ReadonlyArray<number>;
}

const JUSTIFICATION: Readonly<Record<TownClass, string>> = {
  union_district_member: 'included in its union district',
  own_district: 'is its own district',
  no_operating_district:
    'has no operating district, so its pupils belong to no district total. Excluded ' +
    'rather than dropped: the pupils are real and must stay visible.',
  out_of_state_member:
    'is a real out-of-state member town of an interstate district. Its pupils are ' +
    'that state’s, so it earns no Vermont ADM, but it is not a reporting bucket.',
  residency_bucket:
    'is an AOE residency reporting bucket rather than a place, and is awarded no ADM.',
};

/** Null is contagious: one town's unknown count makes the district's unknown. */
function addNullable(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Number((a + b).toFixed(2));
}

function sumBand(values: ReadonlyArray<ReadonlyArray<number | null>>, band: number): number {
  return Number(values.reduce((acc, v) => acc + (v[band] ?? 0), 0).toFixed(2));
}

export function aggregate(joined: ReadonlyArray<JoinedRow>, bandCount: number): Rollup {
  const byDistrict = new Map<string, { towns: string[]; values: (number | null)[] }>();
  const exclusions: Exclusion[] = [];

  for (const j of joined) {
    if (!earnsVermontAdm(j.town_class)) {
      const total = Number(j.row.values.reduce<number>((a, v) => a + (v ?? 0), 0).toFixed(2));
      exclusions.push({
        aoe_org_id: j.row.aoe_org_id,
        slug: j.slug,
        name_as_published: j.row.name_as_published,
        town_class: j.town_class,
        values: j.row.values,
        total,
        justification: JUSTIFICATION[j.town_class],
      });
      continue;
    }

    // A union district member rolls into its district; a town that is its own
    // district is keyed by itself.
    const key =
      j.town_class === 'union_district_member' && j.entity.operated_by
        ? j.entity.operated_by
        : j.slug;

    const acc = byDistrict.get(key) ?? {
      towns: [],
      values: Array.from({ length: bandCount }, () => 0 as number | null),
    };
    acc.towns.push(j.slug);
    for (let b = 0; b < bandCount; b++) {
      acc.values[b] = addNullable(acc.values[b] ?? null, j.row.values[b] ?? null);
    }
    byDistrict.set(key, acc);
  }

  const districts: DistrictTotal[] = [...byDistrict.entries()]
    .map(([district, { towns, values }]) => ({
      district,
      member_towns: [...towns].sort(),
      values,
    }))
    .sort((a, b) => a.district.localeCompare(b.district));

  // The invariant totals are computed from the underlying per-town rows, not
  // from `districts[].values`. `districts[].values` deliberately keeps null
  // contagion -- one town's unknown count makes the whole district's count
  // unknown, so a real neighboring town's number must not be published inside
  // it. But re-summing THAT nulled-out total with `?? 0` would erase a real
  // pupil count from the invariant check itself (a district with [10, null]
  // and [5, 5] merges to district value null for band 1, which would sum to 0
  // and falsely accuse the rollup of losing 5 pupils it never lost). Summing
  // each row's own value with `?? 0` sidesteps that: a row missing a band
  // simply contributes nothing to that band's total, on both sides of the
  // invariant, which is the arithmetic identity the check actually relies on.
  const rowsInDistricts = joined
    .filter((j) => earnsVermontAdm(j.town_class))
    .map((j) => j.row.values);
  const town_band_totals = Array.from({ length: bandCount }, (_, b) =>
    sumBand(joined.map((j) => j.row.values), b),
  );
  const district_band_totals = Array.from({ length: bandCount }, (_, b) =>
    sumBand(rowsInDistricts, b),
  );
  const excluded_band_totals = Array.from({ length: bandCount }, (_, b) =>
    sumBand(exclusions.map((e) => e.values), b),
  );

  for (let b = 0; b < bandCount; b++) {
    const recombined = Number(
      ((district_band_totals[b] ?? 0) + (excluded_band_totals[b] ?? 0)).toFixed(2),
    );
    const expected = town_band_totals[b] ?? 0;
    if (Math.abs(recombined - expected) > 0.005) {
      throw new Error(
        `Conservation failed for band ${b}: districts ${district_band_totals[b]} + ` +
          `exclusions ${excluded_band_totals[b]} = ${recombined}, but the town-level ` +
          `total is ${expected} (difference ${(recombined - expected).toFixed(2)}).\n\n` +
          `Every pupil must land in a district total or in a named exclusion. A ` +
          `mismatch means the rollup is losing towns -- which is exactly how an ` +
          `operated_by-keyed rollup would quietly drop Burlington, Rutland City and ` +
          `56 others. Do not relax this check; find the missing towns.`,
      );
    }
  }

  return {
    districts,
    exclusions,
    town_band_totals,
    district_band_totals,
    excluded_band_totals,
  };
}
