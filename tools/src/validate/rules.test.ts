import { describe, expect, it } from 'vitest';

import {
  checkAdmCrossCheck,
  checkArtifactHashCollisions,
  checkNullAccounting,
  checkRegistryRefs,
  collectArtifactEntries,
  collectNullPaths,
  type BudgetRecord,
  type ProvenanceEntryRef,
} from './rules.ts';
import type { RegistryEntity } from '../registry/types.ts';

function record(over: Partial<BudgetRecord> = {}): BudgetRecord {
  return {
    schema_version: '1.0',
    entity: 'ud/test-55',
    fiscal_year: 2027,
    status: 'proposed',
    source: 'intake/test/fy2027/budget.pdf',
    education_spending: 1_150_000,
    adm: {
      prekindergarten: 10,
      kindergarten_through_5: 100,
      grades_6_through_8: 50,
      grades_9_through_12: 50,
    },
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

  it('rejects an unexplained null in an ADM band', () => {
    const r = record({
      adm: { prekindergarten: null, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
    });
    const findings = checkNullAccounting(r, 'f.yaml');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.message).toMatch(/adm\.prekindergarten is null/);
  });

  it('accepts the same null once it is confirmed absent from the source', () => {
    const r = record({
      adm: { prekindergarten: null, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
      not_published: [{ path: 'adm.prekindergarten', confirmed_by: 'jn', confirmed_date: '2026-07-29' }],
    });
    expect(checkNullAccounting(r, 'f.yaml')).toHaveLength(0);
  });

  it('accepts a null explained as a flagged line instead', () => {
    const r = record({
      education_spending: null,
      lines_flagged: [{ path: 'education_spending', issue: 'education spending not yet transcribed' }],
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
    // A missing date is not a missing figure.
    const r = record({ adopted_date: null });
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

describe('adm cross-check', () => {
  const rec = () => ({
    adm: { prekindergarten: 10, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 },
  }) as any;

  it('is silent when no AOE figure is available', () => {
    expect(checkAdmCrossCheck(rec(), null, 'f.yaml')).toHaveLength(0);
  });

  it('is silent when the figures agree within tolerance', () => {
    const aoe = { prekindergarten: 10.2, kindergarten_through_5: 100, grades_6_through_8: 50, grades_9_through_12: 50 };
    expect(checkAdmCrossCheck(rec(), aoe, 'f.yaml')).toHaveLength(0);
  });

  it('warns (never errors) on a band that disagrees beyond tolerance', () => {
    const aoe = { prekindergarten: 10, kindergarten_through_5: 130, grades_6_through_8: 50, grades_9_through_12: 50 };
    const findings = checkAdmCrossCheck(rec(), aoe, 'f.yaml');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.message).toMatch(/kindergarten_through_5/);
  });
});

describe('collectArtifactEntries', () => {
  it('flattens a provenance doc into one ref per artifact, tagged with its file', () => {
    const doc = {
      entity: 'su/addison-central',
      fiscal_year: 2025,
      artifacts: [
        { file: 'a.pdf', sha256: 'a'.repeat(64) },
        { file: 'b.pdf', sha256: 'b'.repeat(64) },
      ],
    } as never;
    const refs = collectArtifactEntries(doc, 'intake/su-x/fy2025/provenance.yaml');
    expect(refs).toEqual([
      { sha256: 'a'.repeat(64), file: 'a.pdf', provenanceFile: 'intake/su-x/fy2025/provenance.yaml' },
      { sha256: 'b'.repeat(64), file: 'b.pdf', provenanceFile: 'intake/su-x/fy2025/provenance.yaml' },
    ]);
  });
});

describe('checkArtifactHashCollisions', () => {
  const ref = (over: Partial<ProvenanceEntryRef>): ProvenanceEntryRef => ({
    sha256: 'a'.repeat(64),
    file: 'x.pdf',
    provenanceFile: 'intake/su-x/fy2025/provenance.yaml',
    ...over,
  });

  it('passes when every sha256 is unique', () => {
    const findings = checkArtifactHashCollisions([
      ref({ sha256: 'a'.repeat(64), file: 'a.pdf' }),
      ref({ sha256: 'b'.repeat(64), file: 'b.pdf' }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('errors when one sha256 is claimed by two differently-named artifacts in different files', () => {
    // The exact FY24-hash-pasted-into-FY25 bug this rule exists to catch.
    const dup = '8'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'ACSD Budget Book FY24.pdf', provenanceFile: 'intake/su-addison-central/fy2024/provenance.yaml' }),
      ref({ sha256: dup, file: 'FY25BudgetBookMasterFinalv1.pdf', provenanceFile: 'intake/su-addison-central/fy2025/provenance.yaml' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.rule).toBe('artifact-hash-collision');
    // Message names the shared hash and both artifacts so the fix is obvious.
    expect(findings[0]?.message).toContain(dup);
    expect(findings[0]?.message).toContain('ACSD Budget Book FY24.pdf');
    expect(findings[0]?.message).toContain('FY25BudgetBookMasterFinalv1.pdf');
  });

  it('errors when two artifacts inside the SAME provenance file share a hash', () => {
    const dup = 'c'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'one.pdf' }),
      ref({ sha256: dup, file: 'two.pdf' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
  });

  it('does NOT flag the same bytes recorded under the same filename (legitimate reuse)', () => {
    // e.g. one combined annual report committed under identical names across
    // two fiscal-year dirs. Identical basename => same document, not a paste.
    const dup = 'd'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'Annual Report.pdf', provenanceFile: 'intake/su-x/fy2024/provenance.yaml' }),
      ref({ sha256: dup, file: 'Annual Report.pdf', provenanceFile: 'intake/su-x/fy2025/provenance.yaml' }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('emits one finding per colliding hash group, not one per member', () => {
    const dup = 'e'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'a.pdf' }),
      ref({ sha256: dup, file: 'b.pdf' }),
      ref({ sha256: dup, file: 'c.pdf' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('a.pdf');
    expect(findings[0]?.message).toContain('b.pdf');
    expect(findings[0]?.message).toContain('c.pdf');
  });
});
