import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { walkFiles } from './fs-walk.ts';
import { PATHS, rel } from './paths.ts';
import { isBudgetRecordPath } from './warehouse-budgets.ts';

describe('isBudgetRecordPath', () => {
  it.each([
    'warehouse/aoe-act84/x.yaml',
    'warehouse/aoe-adm/adm25.yaml',
    'warehouse/aoe-adm-subgroups/sy25.yaml',
    'warehouse/aoe-adm-subgroups-su/su-sy24.yaml',
    'warehouse/aoe-edspend/fy2026.yaml',
    'warehouse/census/land-area.yaml',
    'warehouse/small-sparse/x.yaml',
  ])('does not treat %s as a budget record', (path) => {
    expect(isBudgetRecordPath(path)).toBe(false);
  });

  it('treats a supervisory union budget as a budget record', () => {
    expect(isBudgetRecordPath('warehouse/su-addison-central/fy2026.yaml')).toBe(true);
  });

  // The guard that matters: every file the reader would take as a budget really
  // has an entity. A new non-budget warehouse directory that is not excluded
  // (as aoe-adm-subgroups-su was not) fails here instead of crashing build:data.
  it('admits only files that carry an entity from the real warehouse', () => {
    const admitted = walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json')).filter((f) =>
      isBudgetRecordPath(rel(f)),
    );
    expect(admitted.length).toBeGreaterThan(0);
    const missing = admitted
      .filter((f) => {
        const text = readFileSync(f, 'utf8');
        const rec = (f.endsWith('.json') ? JSON.parse(text) : parseYaml(text)) as { entity?: unknown };
        return typeof rec.entity !== 'string';
      })
      .map(rel);
    expect(missing).toEqual([]);
  });
});
