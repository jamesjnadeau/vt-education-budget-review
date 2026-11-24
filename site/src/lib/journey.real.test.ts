import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildJourney, type JourneyInputs } from './journey.ts';

const require = createRequire(import.meta.url);
const url = (name: string) => new URL(`../generated/${name}`, import.meta.url).pathname;
const hasData: boolean = ['registry.json', 'combiner.json', 'adm-subgroups.json', 'groupings.json'].every((f) =>
  existsSync(url(f)),
);

function loadModel(): JourneyInputs {
  const registry = require('../generated/registry.json') as { entities: JourneyInputs['registry'] };
  const combiner = require('../generated/combiner.json') as unknown as JourneyInputs['combiner'];
  const subgroups = require('../generated/adm-subgroups.json') as unknown as JourneyInputs['subgroups'];
  const groupings = require('../generated/groupings.json') as unknown as JourneyInputs['groupings'];
  return { registry: registry.entities, combiner, subgroups, groupings };
}

describe('buildJourney against the real data', () => {
  const skip = !hasData;

  if (!skip) {
    const inputs = loadModel();
    const j = buildJourney(inputs);

    it('builds one town page per active non-closed, non-reporting town', () => {
      const active = inputs.registry.filter((e) => e.type === 'town' && !e.effective_to && !e.reporting_only);
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

    it('never points a union at a grouping one of its towns is not on', () => {
      // C1 regression: when a union's "next" leads to a grouping, every member
      // town must be on that exact committee — none may be unassigned or on a
      // different one (an unassigned district must never be routed to a group).
      for (const u of Object.values(j.unions)) {
        if (u.next?.id !== 'grouping') continue;
        const nextNumber = Number(u.next.href.split('/')[3]);
        const numbers = u.members.map((m) => j.towns[m.town]?.committeeNumber);
        expect(numbers.every((n) => n === nextNumber)).toBe(true);
      }
    });
  } else {
    it.skip('skips real-data checks when generated data is missing', () => {});
  }
});

/** Check the built site (site/dist), for pages that exist only after build:site. */
describe('built /my/ pages', () => {
  const dist = join(import.meta.dirname, '..', '..', 'dist');
  const hasBuild = existsSync(join(dist, 'my'));

  if (hasBuild) {
    const towns = readdirSync(join(dist, 'my', 'town'), { withFileTypes: true }).filter((d) => d.isDirectory());
    const unions = readdirSync(join(dist, 'my', 'union'), { withFileTypes: true }).filter((d) => d.isDirectory());
    const groupings = readdirSync(join(dist, 'my', 'grouping'), { withFileTypes: true }).filter((d) => d.isDirectory());

    it('builds one town directory per active non-closed, non-reporting town', () => {
      const inputs = loadModel();
      const active = inputs.registry.filter((e) => e.type === 'town' && !e.effective_to && !e.reporting_only);
      expect(towns.length).toBe(active.length);
    });

    it('builds union and grouping pages matching the model', () => {
      const inputs = loadModel();
      const j = buildJourney(inputs);
      expect(unions.length).toBe(Object.keys(j.unions).length);
      expect(groupings.length).toBe(Object.keys(j.groupings).length);
    });

    it('renders no NaN, undefined or null as visible text under /my/', () => {
      const bad = ['NaN', 'undefined', 'null'];
      const walk = (dir: string): string[] => {
        let html: string[] = [];
        for (const ent of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, ent.name);
          if (ent.isDirectory()) html = html.concat(walk(p));
          else if (ent.name.endsWith('.html')) html.push(readFileSync(p, 'utf8'));
        }
        return html;
      };
      const all = walk(join(dist, 'my'));
      // "null" can legitimately appear in JS source references; strip <script> blocks
      const textOnly = all
        .map((h) => h.replace(/<script[\s\S]*?<\/script>/g, ' '))
        .join(' ')
        .replace(/<[^>]+>/g, ' ');
      for (const needle of bad) {
        expect(textOnly).not.toContain(` ${needle} `);
      }
    });
  } else {
    it.skip('skips built-page checks when the site is not built', () => {});
  }
});
