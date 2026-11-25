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

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  combinedDensity,
  combinedSubgroupEstimate,
  type CombinerData,
} from './combiner-view.ts';
import { planDistrictInputs, type InputField, type InputPlan } from './district-inputs.ts';

const data = JSON.parse(
  readFileSync(new URL('../generated/combiner.json', import.meta.url), 'utf8'),
) as CombinerData;

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

describe('planDistrictInputs', () => {
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

  it('an unknown entity is refused on every field', () => {
    const plan = planDistrictInputs('ud/not-a-district', data);
    for (const field of FIELDS) expect(plan[field].kind).toBe('refuse');
  });
});
