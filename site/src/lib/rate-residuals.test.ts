import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RATE_RESIDUALS, residualFor } from './rate-residuals.ts';

const root = resolve(import.meta.dirname, '../../..');

function registrySlugs(): Set<string> {
  const out = new Set<string>();
  for (const f of ['town', 'ud', 'sd', 'independent', 'academy']) {
    const path = resolve(root, `registry/entities/${f}.json`);
    if (!existsSync(path)) continue;
    for (const r of JSON.parse(readFileSync(path, 'utf8')).records) out.add(r.slug);
  }
  return out;
}

describe('RATE_RESIDUALS', () => {
  it('has exactly 11 keys and each exists in the registry', () => {
    const keys = Object.keys(RATE_RESIDUALS);
    expect(keys).toHaveLength(11);
    const known = registrySlugs();
    for (const k of keys) expect(known.has(k), k).toBe(true);
  });

  it('matches the row count of the table in docs/act-127-transition.md', () => {
    const lines = readFileSync(resolve(root, 'docs/act-127-transition.md'), 'utf8').split('\n');
    const start = lines.findIndex((l) => l.startsWith('| District | Chain | Published'));
    expect(start).toBeGreaterThan(0);
    let rows = 0;
    for (let i = start + 2; i < lines.length && lines[i]?.startsWith('|'); i++) rows++;
    expect(rows).toBe(Object.keys(RATE_RESIDUALS).length);
  });

  it('has plain reasons without semicolons', () => {
    for (const v of Object.values(RATE_RESIDUALS)) {
      expect(v.length).toBeGreaterThan(20);
      expect(v).not.toContain(';');
    }
  });
});

describe('residual wording', () => {
  it('says what lower or higher is compared to, and never leans on the page showing our math', () => {
    for (const [k, v] of Object.entries(RATE_RESIDUALS)) {
      if (k === 'town/buels-gore') continue;
      expect(v, k).toMatch(/^The State's published rate for .+ is (lower|higher) than what this site's math gets/);
      expect(v, k).not.toMatch(/This page's math|rate change at all/);
    }
  });
  it('is one sentence each', () => {
    for (const [k, v] of Object.entries(RATE_RESIDUALS)) {
      const text = v.replace('Mt. Anthony', 'Mt Anthony');
      expect(text.match(/\.(\s|$)/g)?.length ?? 0, k).toBe(1);
    }
  });
});

describe('residualFor', () => {
  it('returns a reason for Norwich and Hartford', () => {
    expect(residualFor('town/norwich')).toEqual(expect.any(String));
    expect(residualFor('town/hartford')).toEqual(expect.any(String));
  });
  it('returns null for Milton and for null', () => {
    expect(residualFor('town/milton')).toBeNull();
    expect(residualFor(null)).toBeNull();
  });
});
