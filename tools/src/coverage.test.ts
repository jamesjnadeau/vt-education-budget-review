import { describe, expect, it } from 'vitest';
import { buildCoverage } from './coverage.ts';
import type { RegistryEntity } from './registry/types.ts';

// A slug no intake directory or warehouse file can exist for, so every cell of
// it is 'missing' no matter what the real corpus holds.
const SYNTHETIC = 'su/zz-synthetic-test';
const registry = new Map<string, RegistryEntity>([
  [
    SYNTHETIC,
    {
      slug: SYNTHETIC,
      name: 'ZZ Synthetic Test Supervisory Union',
      type: 'su',
      effective_to: null,
    } as unknown as RegistryEntity,
  ],
]);

describe('buildCoverage formUrl', () => {
  const report = buildCoverage(registry, { today: new Date('2026-11-22T00:00:00Z') });

  it('sets formUrl on a cell that is not normalized', () => {
    const cells = report.cells.filter((c) => c.entity === SYNTHETIC);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(c.state).toBe('missing');
      expect(c.formUrl).toBe(
        `/contribute/?entity=${encodeURIComponent(c.entity)}&fiscal_year=${c.fiscalYear}`,
      );
    }
  });

  it('formUrl is null exactly when the cell is normalized (whatever the corpus holds)', () => {
    for (const c of report.cells) {
      expect(c.formUrl === null).toBe(c.state === 'normalized');
    }
  });
});
