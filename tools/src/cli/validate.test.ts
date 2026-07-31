import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../registry/types.ts';
import { correctionsFindings } from './validate.ts';

describe('correctionsFindings', () => {
  let dir: string;
  const registry: ReadonlyMap<string, RegistryEntity> = new Map();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'validate-corrections-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('validates cleanly on a blank, comment-only register', () => {
    // A comment-only document parses to `null` via `parseYaml`, which
    // `readCorrections` treats as an empty register, not malformed. This is
    // the exact regression the review caught: `readData` handed that `null`
    // straight to schemaFindings, which reported "must be object", and to
    // `register.corrections`, which threw `TypeError: Cannot read properties
    // of null` before the validator could print anything.
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, '# Nothing here yet.\n');
    expect(correctionsFindings(path, registry)).toEqual([]);
  });

  it('validates cleanly on an absent register', () => {
    const path = join(dir, 'does-not-exist.yaml');
    expect(correctionsFindings(path, registry)).toEqual([]);
  });

  it('validates cleanly on an explicit empty corrections list', () => {
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, 'schema_version: "1.0"\ncorrections: []\n');
    expect(correctionsFindings(path, registry)).toEqual([]);
  });

  it('reports a malformed register as a finding, not an uncaught throw', () => {
    // The typo readCorrections is built to catch: "correction" instead of
    // "corrections". Confirms the CLI wiring turns that throw into a
    // reportable finding rather than crashing the whole validate run.
    const path = join(dir, 'corrections.yaml');
    writeFileSync(path, 'schema_version: "1.0"\ncorrection: []\n');
    const findings = correctionsFindings(path, registry);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('corrections-unreadable');
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.message).toMatch(/unrecognized key/i);
  });

  it('reports the schema finding -- not corrections-unreadable, and no crash -- when a record is schema-invalid', () => {
    // This is a DIFFERENT path than the malformed-register test above:
    // readCorrections' own shape checks (object, recognized keys, corrections
    // is an array) all pass here, so it returns normally. The record inside
    // is what's invalid -- missing the required `evidence` -- which is
    // exactly the case that exposed the original bug: a `try` wrapping
    // schemaFindings and checkCorrections together let checkCorrections'
    // crash on `c.evidence.class` abort the block before its schema finding
    // could be returned, and reported the whole register as "unreadable"
    // instead of naming the one missing field.
    //
    // The correction must resolve to a REAL registry entity here, unlike the
    // shared empty `registry` used above: checkCorrections stops at
    // correction-unknown-entity before it ever reaches the evidence-tier
    // dereference this test means to exercise, so an empty registry made this
    // test pass against both the broken and the fixed code -- proving
    // nothing. That was caught in review; see the fix report.
    const populatedRegistry: ReadonlyMap<string, RegistryEntity> = new Map([
      [
        'su/addison-central',
        {
          slug: 'su/addison-central',
          name: 'Addison Central Supervisory District',
          type: 'su',
          aoe_org_id: 'SU003',
          aoe_server_id: 6,
          edfi_id: 9003,
          effective_from: '2026-07-29',
          effective_from_basis: 'first_observed',
          effective_to: null,
          effective_to_basis: 'unknown',
          successor: null,
          successor_basis: null,
          supervisory_union: null,
          operated_by: null,
          reporting_only: false,
          member_towns: [],
          grades: [],
          website: 'http://old.example.invalid/',
          latitude: null,
          longitude: null,
          manual_overrides: [],
          notes: null,
        },
      ],
    ]);
    const path = join(dir, 'corrections.yaml');
    writeFileSync(
      path,
      [
        'schema_version: "1.0"',
        'corrections:',
        '  - slug: su/addison-central',
        '    field: website',
        '    aoe_value: http://old.example.invalid/',
        '    aoe_value_observed: "2026-07-29"',
        '    our_value: https://new.example.invalid/',
        '    submitted_by: Tester',
        '    submitted_date: "2026-07-31"',
        '    status: open',
        '    sent_date: null',
        '    note: null',
        '',
      ].join('\n'),
    );
    expect(() => correctionsFindings(path, populatedRegistry)).not.toThrow();
    const findings = correctionsFindings(path, populatedRegistry);
    expect(findings.some((f) => f.rule === 'schema:corrections')).toBe(true);
    expect(findings.map((f) => f.rule)).not.toContain('corrections-unreadable');
  });
});
