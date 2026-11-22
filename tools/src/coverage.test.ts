import { describe, expect, it } from 'vitest';
import { buildCoverage } from './coverage.ts';
import { readRegistry } from './registry/store.ts';

describe('buildCoverage formUrl', () => {
  const report = buildCoverage(readRegistry(), { today: new Date('2026-11-22T00:00:00Z') });

  it('sets formUrl on cells that are not normalized', () => {
    const open = report.cells.filter((c) => c.state !== 'normalized');
    expect(open.length).toBeGreaterThan(0);
    for (const c of open) {
      expect(c.formUrl).toBe(
        `/contribute/?entity=${encodeURIComponent(c.entity)}&fiscal_year=${c.fiscalYear}`,
      );
    }
  });

  it('leaves formUrl null on normalized cells', () => {
    const done = report.cells.filter((c) => c.state === 'normalized');
    expect(done.length).toBeGreaterThan(0);
    for (const c of done) expect(c.formUrl).toBeNull();
  });
});
