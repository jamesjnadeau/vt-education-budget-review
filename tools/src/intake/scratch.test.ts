import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeScratchFile } from './scratch.ts';

describe('writeScratchFile', () => {
  it('creates the directory when it does not exist, then writes the file', () => {
    // Reproduces the intake failure: on a fresh checkout the build directory
    // does not exist, and the success path wrote a commit message into it
    // without creating it first, throwing ENOENT after the document had already
    // been downloaded and validated.
    const base = mkdtempSync(join(tmpdir(), 'scratch-'));
    const dir = join(base, 'build', 'never', 'existed');
    expect(existsSync(dir)).toBe(false);

    const path = writeScratchFile(dir, 'intake-commit.txt', 'the message');

    expect(path).toBe(join(dir, 'intake-commit.txt'));
    expect(readFileSync(path, 'utf8')).toBe('the message');
  });
});
