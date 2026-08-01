import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../paths.ts';
import { FIGURE_FIELDS, STATUSES } from './fields.ts';

// The form labels its inputs with the record paths the builder reads, so these
// two must not drift. This test is the guard: it fails the moment a figure is
// added to FIGURE_FIELDS without a matching form field, or vice versa.
const form = parseYaml(
  readFileSync(join(REPO_ROOT, '.github/ISSUE_TEMPLATE/budget-normalize.yml'), 'utf8'),
) as { labels: string[]; body: Array<{ type: string; id?: string; attributes?: { label?: string; options?: string[] }; validations?: { required?: boolean } }> };

const byLabel = new Map(
  form.body.filter((b) => b.attributes?.label).map((b) => [b.attributes!.label!.toLowerCase(), b]),
);

describe('budget-normalize form', () => {
  it('is auto-labelled budget-normalize', () => {
    expect(form.labels).toContain('budget-normalize');
  });

  it('has a field for every figure the builder reads', () => {
    for (const f of FIGURE_FIELDS) {
      expect(byLabel.has(f.path)).toBe(true);
    }
  });

  it('collects the identity, tax and lines fields', () => {
    for (const label of ['entity', 'fiscal_year', 'status', 'source', 'tax.towns', 'lines_flagged']) {
      expect(byLabel.has(label)).toBe(true);
    }
  });

  it('carries the status enum verbatim', () => {
    expect(byLabel.get('status')?.attributes?.options).toEqual([...STATUSES]);
  });

  it('marks every accountable figure required and leaves descriptive fields optional', () => {
    for (const f of FIGURE_FIELDS) {
      expect(byLabel.get(f.path)?.validations?.required ?? false).toBe(f.accountable);
    }
  });
});
