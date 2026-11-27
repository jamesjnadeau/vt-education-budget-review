import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildJourney, type JourneyInputs } from './journey.ts';
import { isOutOfState } from './display.ts';

const require = createRequire(import.meta.url);
const url = (name: string) => new URL(`../generated/${name}`, import.meta.url).pathname;
const hasData: boolean = ['registry.json', 'combiner.json', 'adm-subgroups.json', 'groupings.json'].every((f) =>
  existsSync(url(f)),
);

const emptyInputs = (registry: unknown[]) =>
  ({
    registry,
    combiner: { towns: {}, districts: {}, unions: {}, fiscal_year: 2026 },
    subgroups: { years: [], towns: {} },
    groupings: { groupings: [] },
  }) as unknown as JourneyInputs;

describe('journey leaves out-of-state towns out', () => {
  it('drops a town whose name ends in NH from pages and the town list', () => {
    const E = (slug: string, name: string) => ({
      slug,
      name,
      type: 'town',
      effective_to: null,
      reporting_only: false,
      supervisory_union: null,
      operated_by: null,
    });
    const j = buildJourney(emptyInputs([E('town/orford-nh', 'ORFORD NH'), E('town/norwich', 'NORWICH')]));
    expect(j.towns['orford-nh']).toBeUndefined();
    expect(j.townList.map((t) => t.slug)).toEqual(['norwich']);
  });

  it.skipIf(!hasData)('has no out-of-state town in the real journey', () => {
    const registry = require('../generated/registry.json') as { entities: JourneyInputs['registry'] };
    const j = buildJourney({
      registry: registry.entities,
      combiner: require('../generated/combiner.json'),
      subgroups: require('../generated/adm-subgroups.json'),
      groupings: require('../generated/groupings.json'),
    } as JourneyInputs);
    const outOfState = registry.entities.filter((e) => e.type === 'town' && isOutOfState(e)).map((e) => e.slug.split('/')[1]).filter((s): s is string => s !== undefined);
    expect(outOfState.length).toBeGreaterThan(0);
    for (const s of outOfState) {
      expect(j.towns[s]).toBeUndefined();
      expect(j.townList.some((t) => t.slug === s)).toBe(false);
    }
  });
});
