/**
 * What the what-if form may suggest for a district's four inputs: the economic
 * disadvantage count, English learners, density and common level of appraisal.
 * Each is a suggestion with a source, a choice, or a plain refusal. Never a
 * demo number.
 *
 * These four inputs come from the SY25 AOE counts, the 2020 Census and the
 * August 2025 tax-rates file. None varies by year in the held data, so one
 * check per district covers every year the site shows.
 */

import { existsSync, readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  combinedDensity,
  combinedSubgroupEstimate,
  type CombinerData,
} from './combiner-view.ts';
import { emptyBoxCopy, planDistrictInputs, type InputField, type InputPlan } from './district-inputs.ts';

// combiner.json is generated (git-ignored). Without it the data-driven tests skip,
// as in site/src/lib/journey.real.test.ts, and the data is loaded only inside them.
const DATA_FILE = new URL('../generated/combiner.json', import.meta.url);
const HAVE_DATA = existsSync(DATA_FILE);
let data = { districts: {}, towns: {} } as unknown as CombinerData;

const FIELDS: InputField[] = ['econ', 'el', 'density', 'cla'];
const DEMO: Record<InputField, number> = { econ: 40, el: 8, density: 30, cla: 0.8 };

// Pinned from warehouse/tax-rates/fy2026.yaml (Vermont Department of Taxes, August 18, 2025).
const HINESBURG_CLA = 1.148;
const SHELBURNE_CLA = 0.624;

function plans() {
  return Object.keys(data.districts).map((slug) => [slug, planDistrictInputs(slug, data)] as const);
}

function sourceValue(slug: string, field: InputField): number | null {
  if (field === 'econ') return combinedSubgroupEstimate([slug], data, 'frl')?.sum ?? null;
  if (field === 'el') return combinedSubgroupEstimate([slug], data, 'ell')?.sum ?? null;
  if (field === 'density') return combinedDensity([slug], data)?.density2020 ?? null;
  const towns = data.districts[slug]?.towns ?? [];
  return towns.length === 1 ? (data.towns[towns[0] as string]?.cla ?? null) : null;
}

describe('planDistrictInputs without data', () => {
  it('an unknown entity is refused on every field', () => {
    const empty = { fiscal_year: 2026, districts: {}, towns: {}, sus: {}, groupings: [] } as CombinerData;
    const plan = planDistrictInputs('ud/not-a-district', empty);
    for (const field of FIELDS) expect(plan[field].kind).toBe('refuse');
  });
});

describe('emptyBoxCopy', () => {
  const refused = (reason: string): InputPlan => ({ kind: 'refuse', reason });
  const suggest: InputPlan = { kind: 'suggest', value: 1, note: 'n', tickByDefault: false };
  const plans = { econ: suggest, el: refused('The English learner count for this district is not published.'), density: suggest, cla: suggest };

  it('asks the reader to fill in an empty box, capitalised, without blaming the source', () => {
    const text = emptyBoxCopy('English learner pupils', { ...plans, el: suggest });
    expect(text).toBe('Fill in the "Students learning English" box to see this result.');
    expect(text).not.toMatch(/not published|source document/);
  });
  it('uses the plan reason when the source really has no figure', () => {
    expect(emptyBoxCopy('English learner pupils', plans)).toBe(
      'The English learner count for this district is not published.',
    );
  });
  it('names the CLA box for any town label', () => {
    expect(emptyBoxCopy('your town common level of appraisal', null)).toContain('Common level of appraisal');
  });
  it('falls back to the engine label for other boxes, and starts with a capital', () => {
    const text = emptyBoxCopy('Education spending', null);
    expect(text).toBe('Fill in the "Education spending" box to see this result.');
    expect(text).toMatch(/^[A-Z]/);
  });
});

describe.skipIf(!HAVE_DATA)('planDistrictInputs on the built data', () => {
  beforeAll(() => {
    data = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as CombinerData;
  });

  it('every district gets a plan for all four fields, never a placeholder', () => {
    expect(plans().length).toBeGreaterThan(100);
    for (const [slug, plan] of plans()) {
      for (const field of FIELDS) {
        const p: InputPlan = plan[field];
        expect(['suggest', 'choose', 'refuse'], `${slug} ${field}`).toContain(p.kind);
        if (p.kind === 'suggest') {
          if (p.value === DEMO[field]) expect(p.value, `${slug} ${field}`).toBe(sourceValue(slug, field));
          expect(p.note.length).toBeGreaterThan(0);
        }
        if (p.kind === 'refuse') expect(p.reason.length).toBeGreaterThan(0);
        if (p.kind === 'choose') expect(field).toBe('cla');
      }
    }
  });

  it('econ is never ticked by default', () => {
    for (const [slug, plan] of plans()) {
      const p = plan.econ;
      if (p.kind === 'suggest') expect(p.tickByDefault, slug).toBe(false);
    }
  });

  it('withheld ELL is offered unticked with "at least"', () => {
    const withheld = Object.keys(data.districts).filter((slug) => {
      const e = combinedSubgroupEstimate([slug], data, 'ell');
      return e !== null && e.sum > 0 && (e.withheld.length > 0 || e.missing.length > 0);
    });
    expect(withheld.length).toBeGreaterThan(0);
    for (const slug of withheld) {
      const p = planDistrictInputs(slug, data).el;
      expect(p.kind, slug).toBe('suggest');
      if (p.kind !== 'suggest') continue;
      expect(p.tickByDefault, slug).toBe(false);
      expect(p.note, slug).toContain('at least');
    }
  });

  it('a complete ELL count is ticked by default', () => {
    const complete = Object.keys(data.districts).find((slug) => {
      const e = combinedSubgroupEstimate([slug], data, 'ell');
      return e !== null && e.withheld.length === 0 && e.missing.length === 0;
    });
    expect(complete).toBeDefined();
    const p = planDistrictInputs(complete as string, data).el;
    expect(p.kind === 'suggest' && p.tickByDefault).toBe(true);
  });

  it('multi-town CLA is a choice, not a value', () => {
    const p = planDistrictInputs('ud/champlain-valley-56', data).cla;
    expect(p.kind).toBe('choose');
    if (p.kind !== 'choose') return;
    const by = Object.fromEntries(p.choices.map((c) => [c.town, c.cla]));
    expect(by['town/hinesburg']).toBe(HINESBURG_CLA);
    expect(by['town/shelburne']).toBe(SHELBURNE_CLA);
    expect(p.choices.find((c) => c.town === 'town/hinesburg')?.label).toContain('Hinesburg');
    expect(p.note).toMatch(/pick your town/i);
    expect(p.note).not.toContain(';');
  });

  it('single-town CLA is suggested', () => {
    const p = planDistrictInputs('town/milton', data).cla;
    expect(p.kind).toBe('suggest');
    if (p.kind !== 'suggest') return;
    expect(p.value).toBe(data.towns['town/milton']?.cla);
    expect(p.tickByDefault).toBe(true);
    expect(p.note).toBe(
      'Common level of appraisal for Milton, Vermont Department of Taxes, August 18, 2025.',
    );
  });

  it('density is suggested from the 2020 Census and ticked', () => {
    const p = planDistrictInputs('town/milton', data).density;
    expect(p.kind).toBe('suggest');
    if (p.kind !== 'suggest') return;
    expect(p.value).toBe(combinedDensity(['town/milton'], data)?.density2020);
    expect(p.tickByDefault).toBe(true);
  });
});
