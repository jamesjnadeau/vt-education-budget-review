import { describe, expect, it } from 'vitest';

import {
  checkNullAccounting,
  checkRegistryRefs,
  collectNullPaths,
  type BudgetRecord,
} from './rules.ts';
import type { RegistryEntity } from '../registry/types.ts';

function record(over: Partial<BudgetRecord> = {}): BudgetRecord {
  return {
    schema_version: '1.0',
    entity: 'ud/test-55',
    fiscal_year: 2027,
    status: 'proposed',
    source: 'intake/test/fy2027/budget.pdf',
    revenues: { education_fund: 1000, local: 100, federal: 50, other: 0 },
    expenditures: {
      instruction: 600,
      special_education: 200,
      administration_district: 100,
      administration_school: 80,
      operations_maintenance: 90,
      transportation: 50,
      debt_service: 20,
      other: 10,
    },
    personnel: {
      total_staff_costs: 800,
      salaries: 600,
      benefits_health: 150,
      benefits_other: 50,
      fte: { teachers: 20, support_staff: 10, administrators: 3, total: 33 },
      as_stated_note: null,
    },
    enrollment: { adm: 250 },
    per_pupil: { as_stated: 4600 },
    tax: { towns: [{ town: 'town/test', homestead_rate_stated: 1.5, cla: 0.9 }] },
    not_published: [],
    lines_flagged: [],
    ...over,
  } as BudgetRecord;
}

describe('collectNullPaths', () => {
  it('finds nulls at any depth, including inside arrays', () => {
    const paths = collectNullPaths({
      a: null,
      b: { c: null, d: 1 },
      e: [{ f: null }, { f: 2 }],
    });
    expect(paths).toEqual(['a', 'b.c', 'e.0.f']);
  });
});

describe('null accounting', () => {
  // This rule is what makes a null mean "the district did not publish it"
  // rather than "nobody looked". Without it the two are indistinguishable.

  it('passes a record with no nulls', () => {
    expect(checkNullAccounting(record(), 'f.yaml')).toHaveLength(0);
  });

  it('rejects an unexplained null in the personnel block', () => {
    const r = record({
      personnel: {
        total_staff_costs: 800,
        salaries: 600,
        benefits_health: null,
        benefits_other: 50,
        fte: { teachers: 20, support_staff: 10, administrators: 3, total: 33 },
        as_stated_note: null,
      },
    });
    const findings = checkNullAccounting(r, 'f.yaml');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.message).toMatch(/personnel\.benefits_health is null/);
    expect(findings[0]?.message).toMatch(/cannot be distinguished from a field nobody checked/);
  });

  it('accepts the same null once it is confirmed absent from the source', () => {
    const r = record({
      personnel: {
        total_staff_costs: 800,
        salaries: 600,
        benefits_health: null,
        benefits_other: 50,
        fte: { teachers: 20, support_staff: 10, administrators: 3, total: 33 },
        as_stated_note: 'this document does not break out health insurance',
      },
      not_published: [
        { path: 'personnel.benefits_health', confirmed_by: 'jn', confirmed_date: '2026-07-29' },
      ],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });

  it('accepts a null explained as a flagged line instead', () => {
    const r = record({
      enrollment: { adm: null },
      lines_flagged: [{ path: 'enrollment.adm', issue: 'document gives two conflicting ADM figures' }],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });

  it('lets one entry cover a whole town table rather than demanding one per town', () => {
    const r = record({
      tax: {
        towns: [
          { town: 'town/a', homestead_rate_stated: null, cla: null },
          { town: 'town/b', homestead_rate_stated: null, cla: null },
        ],
      },
      not_published: [
        { path: 'tax.towns.homestead_rate_stated', confirmed_by: 'jn', confirmed_date: '2026-07-29' },
        { path: 'tax.towns.cla', confirmed_by: 'jn', confirmed_date: '2026-07-29' },
      ],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });

  it('does not demand an explanation for optional descriptive fields', () => {
    // A missing note is not a missing figure.
    const r = record({ membership_note: null, adopted_date: null });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });
});

describe('registry references', () => {
  const registry = new Map<string, RegistryEntity>([
    ['town/test', { slug: 'town/test' } as RegistryEntity],
    ['ud/test-55', { slug: 'ud/test-55' } as RegistryEntity],
  ]);

  it('accepts slugs that resolve', () => {
    expect(checkRegistryRefs(record(), 'f.yaml', registry)).toHaveLength(0);
  });

  it('rejects a slug that does not', () => {
    const r = record({ tax: { towns: [{ town: 'town/nowhere', homestead_rate_stated: 1, cla: 1 }] } });
    const findings = checkRegistryRefs(r, 'f.yaml', registry);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/"town\/nowhere" is not a known registry entity/);
  });

  it('reports each unknown slug once, not once per occurrence', () => {
    const r = record({
      entity: 'ud/gone',
      tax: {
        towns: [
          { town: 'ud/gone', homestead_rate_stated: 1, cla: 1 },
          { town: 'ud/gone', homestead_rate_stated: 1, cla: 1 },
        ],
      },
    });
    expect(checkRegistryRefs(r, 'f.yaml', registry)).toHaveLength(1);
  });
});

describe('source references are not registry references', () => {
  // A statewide AOE dataset has no organization record in AOE's own API -- the
  // only state/ entity is Woodside, closed in 2020 -- so provenance for it
  // cannot name a registry entity. A source/ prefix says "this is a publisher,
  // not an organization in the registry" without weakening the rule that every
  // real entity slug must resolve.
  //
  // Both cases already held before SOURCE_REF was added, because ENTITY_REF
  // never matched a source/ slug in the first place. They are pinned anyway:
  // ENTITY_REF and the entity_ref pattern in common-1.0.schema.json are mirrored
  // lists, and the schema's now includes source. Widening ENTITY_REF to match
  // would silently start demanding that publishers resolve to registry entities,
  // which is the one thing a source/ slug exists to avoid.
  it('accepts a source/ slug with no registry entity', () => {
    const findings = checkRegistryRefs(
      { entity: 'source/aoe-adm' },
      'intake/aoe-adm/fy2024/provenance.yaml',
      new Map(),
    );
    expect(findings).toEqual([]);
  });

  it('still rejects an unknown entity slug', () => {
    const findings = checkRegistryRefs(
      { entity: 'town/nowhere' },
      'intake/aoe-adm/fy2024/provenance.yaml',
      new Map(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('registry-reference');
  });
});
