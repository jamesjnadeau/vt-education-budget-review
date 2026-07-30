import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../../paths.ts';
import { readRegistry } from '../../registry/store.ts';
import type { RegistryEntity } from '../../registry/types.ts';
import { aggregate, assertConservation } from './aggregate.ts';
import type { TownClass } from './classify.ts';
import { joinRows, type JoinedRow } from './join.ts';
import { parseReport } from './parse.ts';

function joined(
  aoe_org_id: string,
  slug: string,
  town_class: TownClass,
  values: (number | null)[],
  operated_by: string | null = null,
): JoinedRow {
  return {
    row: { aoe_org_id, name_as_published: slug, values },
    slug,
    town_class,
    entity: { slug, aoe_org_id, operated_by, type: 'town' } as RegistryEntity,
  };
}

describe('rolling towns up to districts', () => {
  it('sums union district members into their district', () => {
    const rollup = aggregate(
      [
        joined('T074', 'town/fairlee', 'union_district_member', [10, 5], 'ud/rivendell-interstate'),
        joined('T215', 'town/vershire', 'union_district_member', [20, 7], 'ud/rivendell-interstate'),
      ],
      2,
    );
    expect(rollup.districts).toHaveLength(1);
    expect(rollup.districts[0]?.district).toBe('ud/rivendell-interstate');
    expect(rollup.districts[0]?.values).toEqual([30, 12]);
    expect(rollup.districts[0]?.member_towns).toEqual(['town/fairlee', 'town/vershire']);
  });

  it('makes a town that is its own district a district in its own right', () => {
    const rollup = aggregate([joined('T037', 'town/burlington', 'own_district', [500, 300])], 2);
    expect(rollup.districts).toHaveLength(1);
    expect(rollup.districts[0]?.district).toBe('town/burlington');
    expect(rollup.districts[0]?.values).toEqual([500, 300]);
  });

  it('excludes buckets and out-of-state members, with a justification each', () => {
    const rollup = aggregate(
      [
        joined('T001', 'town/addison', 'union_district_member', [10, 5], 'ud/x'),
        joined('902', 'town/other-state-new-hampshire', 'residency_bucket', [0, 0]),
        joined('T999', 'town/orford-nh', 'out_of_state_member', [0, 0]),
      ],
      2,
    );
    expect(rollup.exclusions.map((e) => e.aoe_org_id).sort()).toEqual(['902', 'T999']);
    for (const e of rollup.exclusions) expect(e.justification).toMatch(/\S/);
  });

  it('excludes a town with real pupils and no operating district, and says so', () => {
    // Buels Gore reports 1 / 3 / 0 in ADM-25 and has no operating district. Its
    // pupils must be visible as an exclusion, never silently dropped.
    const rollup = aggregate(
      [
        joined('T001', 'town/addison', 'union_district_member', [10, 5], 'ud/x'),
        joined('T255', 'town/buels-gore', 'no_operating_district', [4, 0]),
      ],
      2,
    );
    const gore = rollup.exclusions.find((e) => e.aoe_org_id === 'T255');
    expect(gore?.total).toBe(4);
    expect(gore?.justification).toMatch(/no operating district/i);
    expect(rollup.district_band_totals).toEqual([10, 5]);
    expect(rollup.excluded_band_totals).toEqual([4, 0]);
    expect(rollup.town_band_totals).toEqual([14, 5]);
  });

  it('conserves every pupil: districts plus exclusions equal the town total', () => {
    const rollup = aggregate(
      [
        joined('T001', 'town/a', 'union_district_member', [10.5, 5.25], 'ud/x'),
        joined('T002', 'town/b', 'union_district_member', [1.5, 2.75], 'ud/x'),
        joined('T037', 'town/c', 'own_district', [100, 50]),
        joined('T255', 'town/d', 'no_operating_district', [4, 0]),
        joined('902', 'town/e', 'residency_bucket', [0, 0]),
      ],
      2,
    );
    for (let band = 0; band < 2; band++) {
      expect(
        Number(
          (
            (rollup.district_band_totals[band] ?? 0) + (rollup.excluded_band_totals[band] ?? 0)
          ).toFixed(2),
        ),
      ).toBe(rollup.town_band_totals[band]);
    }
  });

  it('treats a null as unknown rather than zero when summing a district', () => {
    // One town's missing count makes the district's count unknown. Coercing to
    // zero would publish a district total that is quietly too low.
    const rollup = aggregate(
      [
        joined('T001', 'town/a', 'union_district_member', [10, null], 'ud/x'),
        joined('T002', 'town/b', 'union_district_member', [5, 5], 'ud/x'),
      ],
      2,
    );
    expect(rollup.districts[0]?.values).toEqual([15, null]);
  });
});

describe('the conservation guard can actually fail', () => {
  // The first implementation of this guard derived both sides independently from
  // the same input -- districts from the rows that earn ADM, exclusions from the
  // rows that do not -- which made them a partition of the input and so equal by
  // construction. It could not throw for any input whatsoever. These tests pin
  // the negative path directly, because with the wiring correct no input to
  // aggregate() can make the check fire: that is what "the guard holds" means.

  it('throws when the district side is short a town, naming band and difference', () => {
    // 14 pupils were counted at town level; only 10 reached a district and none
    // was excluded. The missing 4 are exactly the Burlington-class bug.
    expect(() => assertConservation([14, 5], [10, 5], [0, 0])).toThrow(/band 0/);
    expect(() => assertConservation([14, 5], [10, 5], [0, 0])).toThrow(/-4\.00/);
  });

  it('throws when a band other than the first is the one that fails', () => {
    expect(() => assertConservation([10, 5], [10, 2], [0, 0])).toThrow(/band 1/);
  });

  it('throws when the two sides double-count rather than lose', () => {
    expect(() => assertConservation([10, 5], [10, 5], [3, 0])).toThrow(/band 0/);
  });

  it('does not throw when districts plus exclusions reconcile', () => {
    expect(() => assertConservation([14, 5], [10, 5], [4, 0])).not.toThrow();
  });

  it('tolerates a sub-half-cent rounding difference but not a larger one', () => {
    expect(() => assertConservation([10, 0], [9.996, 0], [0, 0])).not.toThrow();
    expect(() => assertConservation([10, 0], [9.98, 0], [0, 0])).toThrow(/band 0/);
  });

  it('refuses to relax: the message tells a reader to find the towns', () => {
    expect(() => assertConservation([14, 5], [10, 5], [0, 0])).toThrow(
      /Do not relax this check/i,
    );
  });
});

describe('the guard is wired to the totals that get published', () => {
  it('ties district_band_totals to the districts the rollup actually returns', () => {
    // The spec's falsifiability requirement: the district side of the ledger must
    // come from the same accumulator that produced districts[].values, so that a
    // merge overwriting instead of accumulating moves both together and the check
    // still catches it. With no nulls in play the two must agree exactly.
    const rollup = aggregate(
      [
        joined('T001', 'town/a', 'union_district_member', [10.5, 5.25], 'ud/x'),
        joined('T002', 'town/b', 'union_district_member', [1.5, 2.75], 'ud/x'),
        joined('T037', 'town/c', 'own_district', [100, 50]),
      ],
      2,
    );
    for (let band = 0; band < 2; band++) {
      const fromPublished = Number(
        rollup.districts.reduce((acc, d) => acc + (d.values[band] ?? 0), 0).toFixed(2),
      );
      expect(fromPublished).toBe(rollup.district_band_totals[band]);
    }
  });

  it('keeps a district’s known pupils in the ledger when one town’s band is unknown', () => {
    // The regression the pre-null-contagion implementation caused: town b's 5
    // real pupils must stay on the district side of the invariant even though
    // the district publishes null for that band, or the guard accuses the rollup
    // of losing pupils it never lost.
    const rollup = aggregate(
      [
        joined('T001', 'town/a', 'union_district_member', [10, null], 'ud/x'),
        joined('T002', 'town/b', 'union_district_member', [5, 5], 'ud/x'),
      ],
      2,
    );
    expect(rollup.districts[0]?.values).toEqual([15, null]);
    expect(rollup.district_band_totals).toEqual([15, 5]);
    expect(rollup.town_band_totals).toEqual([15, 5]);
  });
});

describe.skipIf(
  !existsSync(
    join(REPO_ROOT, 'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx'),
  ),
)('conservation against the real ADM-24 artifact', () => {
  it('conserves the pinned grand total across the rollup', async () => {
    const parsed = await parseReport(
      join(REPO_ROOT, 'intake/aoe-adm/fy2024/edu-average-daily-membership-by-resident-district-fy24.xlsx'),
    );
    const rollup = aggregate(joinRows(parsed.rows, readRegistry()), parsed.bands_as_published.length);

    const districts = rollup.district_band_totals.reduce((a, b) => a + b, 0);
    const excluded = rollup.excluded_band_totals.reduce((a, b) => a + b, 0);
    expect(Number((districts + excluded).toFixed(2))).toBeCloseTo(83987.27, 2);

    // Burlington must be a district in its own right, not a dropped town.
    expect(rollup.districts.map((d) => d.district)).toContain('town/burlington');
  });
});
