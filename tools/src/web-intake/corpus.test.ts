import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collisionError, findDuplicate } from './corpus.ts';

const SHA = 'a'.repeat(64);

function setup(): string {
  const root = mkdtempSync(join(tmpdir(), 'corpus-'));
  mkdirSync(join(root, 'intake/a/fy2026'), { recursive: true });
  writeFileSync(
    join(root, 'intake/a/fy2026/provenance.yaml'),
    `artifacts:\n  - file: x.pdf\n    sha256: ${SHA}\n`,
  );
  return root;
}

describe('findDuplicate', () => {
  it('returns the repo-relative path of a matching artifact', () => {
    const root = setup();
    expect(findDuplicate(SHA, join(root, 'intake'))).toBe('intake/a/fy2026/x.pdf');
  });

  it('returns null for an unknown hash', () => {
    const root = setup();
    expect(findDuplicate('b'.repeat(64), join(root, 'intake'))).toBeNull();
  });

  it('skips unparseable or odd provenance files', () => {
    const root = setup();
    mkdirSync(join(root, 'intake/b'), { recursive: true });
    writeFileSync(join(root, 'intake/b/provenance.yaml'), ': : [unclosed');
    mkdirSync(join(root, 'intake/c'), { recursive: true });
    writeFileSync(join(root, 'intake/c/provenance.yaml'), 'artifacts: 5\n');
    mkdirSync(join(root, 'intake/d'), { recursive: true });
    writeFileSync(join(root, 'intake/d/provenance.yaml'), 'artifacts:\n  - null\n  - 3\n');
    expect(findDuplicate(SHA, join(root, 'intake'))).toBe('intake/a/fy2026/x.pdf');
  });

  it('does not follow symlinks out of the intake root', () => {
    const root = setup();
    const outside = mkdtempSync(join(tmpdir(), 'outside-'));
    writeFileSync(join(outside, 'provenance.yaml'), `artifacts:\n  - file: y.pdf\n    sha256: ${'c'.repeat(64)}\n`);
    symlinkSync(outside, join(root, 'intake/link'));
    expect(findDuplicate('c'.repeat(64), join(root, 'intake'))).toBeNull();
  });
});

describe('collisionError', () => {
  it('is non-null for an existing file and null otherwise', () => {
    const root = setup();
    expect(collisionError(join(root, 'intake/a/fy2026/provenance.yaml'))).not.toBeNull();
    expect(collisionError(join(root, 'nope.pdf'))).toBeNull();
  });
});
