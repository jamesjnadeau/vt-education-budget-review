import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildJourney, type JourneyInputs } from './journey.ts';

const require = createRequire(import.meta.url);
const url = (name: string) => new URL(`../generated/${name}`, import.meta.url).pathname;
const hasData: boolean = ['registry.json', 'combiner.json', 'adm-subgroups.json', 'groupings.json'].every((f) =>
  existsSync(url(f)),
);

describe('buildJourney against the real data', () => {
  const skip = !hasData;

  if (!skip) {
    const registry = require('../generated/registry.json') as { entities: JourneyInputs['registry'] };
    const combiner = require('../generated/combiner.json') as unknown as JourneyInputs['combiner'];
    const subgroups = require('../generated/adm-subgroups.json') as unknown as JourneyInputs['subgroups'];
    const groupings = require('../generated/groupings.json') as unknown as JourneyInputs['groupings'];
    const j = buildJourney({ registry: registry.entities, combiner, subgroups, groupings });

    it('builds one town page per active non-closed, non-reporting town', () => {
      const active = registry.entities.filter((e) => e.type === 'town' && !e.effective_to && !e.reporting_only);
      expect(Object.keys(j.towns).length).toBe(active.length);
    });

    it('gives every town a non-empty step chain', () => {
      for (const t of Object.values(j.towns)) {
        expect(t.steps.length).toBeGreaterThan(0);
        expect(t.steps[0] !== undefined).toBe(true);
      }
    });

    it('never holds NaN or null in a value figure', () => {
      for (const t of Object.values(j.towns)) {
        for (const f of [t.rate, t.people]) {
          if (f.kind === 'value') {
            expect(Number.isNaN(f.value)).toBe(false);
            expect(f.value).not.toBeNull();
          }
        }
        for (const f of [t.rateScale, t.peopleScale, t.studentsScale]) {
          if (f.kind === 'value') {
            expect(Number.isNaN(f.value.of)).toBe(false);
            expect(Number.isNaN(f.value.lower)).toBe(false);
          }
        }
      }
    });
  } else {
    it.skip('skips real-data checks when generated data is missing', () => {});
  }
});
