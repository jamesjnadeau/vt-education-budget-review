import { describe, expect, it } from 'vitest';

import { validateAgainst } from '../validate/schemas.ts';
import { checkNullAccounting, type BudgetRecord } from '../validate/rules.ts';
import { FIGURE_FIELDS } from './fields.ts';
import { buildRecord, type NormalizeInput } from './record.ts';

const KNOWN = new Set(['su/addison-central', 'town/addison']);

/** A complete, valid submission body, with any heading overridable. */
function body(over: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    entity: 'su/addison-central',
    fiscal_year: '2023',
    status: 'proposed',
    source: 'intake/su-addison-central/fy2023/budget.pdf',
    'tax.towns': 'town/addison, 1.52, 0.8734',
    lines_flagged: '',
  };
  // Every accountable figure gets a number by default; optional/descriptive
  // fields are left blank.
  for (const f of FIGURE_FIELDS) fields[f.path] = f.accountable ? '100' : '';
  Object.assign(fields, over);
  return Object.entries(fields)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `### ${k}\n\n${v}`)
    .join('\n\n');
}

function input(over: Partial<NormalizeInput> = {}): NormalizeInput {
  return {
    body: body(),
    authorLogin: 'octocat',
    today: '2026-07-31',
    knownSlugs: KNOWN,
    sourceExists: () => true,
    ...over,
  };
}

function errorsFrom(over: Partial<NormalizeInput>): readonly string[] {
  const r = buildRecord(input(over));
  if (r.ok) throw new Error('expected rejection');
  return r.errors;
}

describe('buildRecord — happy path', () => {
  it('produces a record that validates against the budget schema', () => {
    const r = buildRecord(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(validateAgainst('budget', r.record)).toEqual([]);
  });

  it('produces a record with no unexplained nulls', () => {
    const r = buildRecord(input());
    if (!r.ok) return;
    expect(checkNullAccounting(r.record as BudgetRecord, 'f.yaml')).toEqual([]);
  });

  it('records identity, source and computed extraction provenance', () => {
    const r = buildRecord(input());
    if (!r.ok) return;
    const rec = r.record as Record<string, any>;
    expect(rec.entity).toBe('su/addison-central');
    expect(rec.fiscal_year).toBe(2023);
    expect(rec.status).toBe('proposed');
    expect(rec.source).toBe('intake/su-addison-central/fy2023/budget.pdf');
    expect(rec.extracted_by).toBe('@octocat');
    expect(rec.extracted_date).toBe('2026-07-31');
    expect(rec.revenues.education_fund).toBe(100);
    expect(rec.tax.towns).toEqual([
      { town: 'town/addison', homestead_rate_stated: 1.52, cla: 0.8734 },
    ]);
  });
});

describe('buildRecord — the sentinel', () => {
  it('turns n/p into a not_published entry attributed to the author and date', () => {
    const r = buildRecord(input({ body: body({ 'personnel.benefits_health': 'n/p' }) }));
    if (!r.ok) throw new Error('expected ok');
    const rec = r.record as Record<string, any>;
    expect(rec.personnel.benefits_health).toBeNull();
    const entry = rec.not_published.find((n: any) => n.path === 'personnel.benefits_health');
    expect(entry).toEqual({
      path: 'personnel.benefits_health',
      confirmed_by: '@octocat',
      confirmed_date: '2026-07-31',
    });
  });

  it('still validates against the schema and null-accounting with an n/p field', () => {
    const r = buildRecord(input({ body: body({ 'personnel.benefits_health': 'n/p' }) }));
    if (!r.ok) throw new Error('expected ok');
    expect(validateAgainst('budget', r.record)).toEqual([]);
    expect(checkNullAccounting(r.record as BudgetRecord, 'f.yaml')).toEqual([]);
  });

  it('rejects an empty accountable field, naming it', () => {
    const errs = errorsFrom({ body: body({ 'expenditures.instruction': '' }) });
    expect(errs.join('\n')).toMatch(/expenditures\.instruction/);
  });

  it('rejects a value that is neither a number nor n/p', () => {
    const errs = errorsFrom({ body: body({ 'revenues.local': 'a lot' }) });
    expect(errs.join('\n')).toMatch(/revenues\.local/);
  });
});

describe('buildRecord — identity validation', () => {
  it('rejects an entity not in the registry', () => {
    expect(errorsFrom({ body: body({ entity: 'su/typo' }) }).join('\n')).toMatch(/registry/i);
  });

  it('rejects a status outside the enum', () => {
    expect(errorsFrom({ body: body({ status: 'draft' }) }).join('\n')).toMatch(/status/i);
  });

  it('rejects a fiscal year outside the schema range', () => {
    expect(errorsFrom({ body: body({ fiscal_year: '1999' }) }).length).toBeGreaterThan(0);
  });

  it('rejects a source that does not match the intake path shape', () => {
    expect(errorsFrom({ body: body({ source: 'somewhere/else.pdf' }) }).join('\n')).toMatch(/source/i);
  });

  it('rejects a source that does not exist in the repository', () => {
    expect(errorsFrom({ sourceExists: () => false }).join('\n')).toMatch(/source/i);
  });
});

describe('buildRecord — tax and lines_flagged', () => {
  it('rejects a bad town slug in the tax table', () => {
    expect(errorsFrom({ body: body({ 'tax.towns': 'town/nowhere, 1.5, 0.9' }) }).length).toBeGreaterThan(0);
  });

  it('records the single-n/p tax block as an empty towns array', () => {
    const r = buildRecord(input({ body: body({ 'tax.towns': 'n/p' }) }));
    if (!r.ok) throw new Error('expected ok');
    expect((r.record as any).tax.towns).toEqual([]);
    expect(validateAgainst('budget', r.record)).toEqual([]);
  });

  it('parses lines_flagged in the path :: issue format', () => {
    const r = buildRecord(
      input({ body: body({ lines_flagged: 'expenditures.other :: bond premium lumped in' }) }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect((r.record as any).lines_flagged).toEqual([
      { path: 'expenditures.other', issue: 'bond premium lumped in', resolution: 'pending' },
    ]);
  });

  it('rejects an unparseable lines_flagged line', () => {
    expect(errorsFrom({ body: body({ lines_flagged: 'no separator here' }) }).length).toBeGreaterThan(0);
  });
});
