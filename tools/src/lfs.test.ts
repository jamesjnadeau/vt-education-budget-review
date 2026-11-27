import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { isFetched, isLfsPointer } from './lfs.ts';

const dir = mkdtempSync(join(tmpdir(), 'lfs-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, content: string | Buffer): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

const POINTER = [
  'version https://git-lfs.github.com/spec/v1',
  'oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393',
  'size 12345',
  '',
].join('\n');

describe('isLfsPointer', () => {
  it('recognizes a pointer file', () => {
    expect(isLfsPointer(file('pointer.xlsx', POINTER))).toBe(true);
  });

  it('does not mistake a real spreadsheet for a pointer', () => {
    // An .xlsx is a zip: it starts with "PK".
    expect(isLfsPointer(file('real.xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])))).toBe(false);
  });

  it('does not treat a file shorter than the prefix as a pointer', () => {
    expect(isLfsPointer(file('short.txt', 'version'))).toBe(false);
    expect(isLfsPointer(file('empty.txt', ''))).toBe(false);
  });
});

describe('isFetched', () => {
  it('is false for a missing file', () => {
    expect(isFetched(join(dir, 'absent.xlsx'))).toBe(false);
  });

  it('is false for a pointer and true for real bytes', () => {
    expect(isFetched(file('p.xlsx', POINTER))).toBe(false);
    expect(isFetched(file('r.xlsx', 'PK\u0003\u0004'))).toBe(true);
  });
});
