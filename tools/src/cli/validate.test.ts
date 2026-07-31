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
});
