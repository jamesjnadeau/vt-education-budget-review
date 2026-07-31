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
    expect(() => correctionsFindings(path, registry)).not.toThrow();
    const findings = correctionsFindings(path, registry);
    expect(findings.some((f) => f.rule === 'schema:corrections')).toBe(true);
    expect(findings.map((f) => f.rule)).not.toContain('corrections-unreadable');
  });
});
