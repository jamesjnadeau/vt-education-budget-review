import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkProvenanceDoc } from './rules.ts';

const LFS_POINTER = 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 10\n';

function fixture(fileContents: string): { dir: string; artifactPath: string; doc: never } {
  const dir = mkdtempSync(join(tmpdir(), 'prov-fetch-'));
  writeFileSync(join(dir, 'budget.pdf'), fileContents);
  const doc = {
    entity: 'su/addison-central',
    fiscal_year: 2025,
    artifacts: [{ file: 'budget.pdf', sha256: 'a'.repeat(64), source_url: 'https://x/budget.pdf' }],
  } as never;
  return { dir, artifactPath: join(dir, 'budget.pdf'), doc };
}

describe('checkProvenanceDoc — selective LFS fetch safety', () => {
  it('errors when an artifact that had to be fetched is still an LFS pointer', () => {
    // A selective `git lfs pull` that silently failed to materialise a changed
    // artifact would leave a pointer here. Verifying nothing and passing is
    // worse than the bandwidth bill, so this must fail the build.
    const { dir, artifactPath, doc } = fixture(LFS_POINTER);
    const findings = checkProvenanceDoc(doc, 'f.yaml', dir, {
      verifyHashes: true,
      requireFetched: new Set([artifactPath]),
    });
    expect(findings.some((f) => f.severity === 'error' && /fetch|pointer|materiali/i.test(f.message))).toBe(true);
  });

  it('only warns for an unfetched artifact that did not change, so unchanged pointers do not block', () => {
    const { dir, doc } = fixture(LFS_POINTER);
    const findings = checkProvenanceDoc(doc, 'f.yaml', dir, {
      verifyHashes: true,
      requireFetched: new Set(),
    });
    expect(findings.some((f) => f.severity === 'warning')).toBe(true);
    expect(findings.some((f) => f.severity === 'error')).toBe(false);
  });

  it('still verifies the hash of a changed artifact that was materialised', () => {
    // Real bytes present, hash does not match the recorded one -> the existing
    // tamper check must still fire.
    const { dir, artifactPath, doc } = fixture('%PDF-1.7 real bytes');
    const findings = checkProvenanceDoc(doc, 'f.yaml', dir, {
      verifyHashes: true,
      requireFetched: new Set([artifactPath]),
    });
    expect(findings.some((f) => f.rule === 'hash-verification' && f.severity === 'error')).toBe(true);
  });
});
