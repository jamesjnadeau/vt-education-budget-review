/**
 * Git LFS pointer detection.
 *
 * Intake artifacts are stored in Git LFS. In a clone that has not run
 * `git lfs pull`, each one is a ~130-byte text pointer instead of the real
 * file. Code that reads an artifact, and tests that read the real thing, need
 * to tell those apart without reading a 100 MB file to do it.
 */
import { closeSync, existsSync, openSync, readSync } from 'node:fs';

/** Every LFS pointer file starts with this line (spec v1). */
export const LFS_POINTER_PREFIX = 'version https://git-lfs';

/** True when the file at `path` is an unfetched Git LFS pointer. Reads only the first bytes. */
export function isLfsPointer(path: string): boolean {
  const prefix = Buffer.byteLength(LFS_POINTER_PREFIX);
  const head = Buffer.alloc(prefix);
  const fd = openSync(path, 'r');
  try {
    const read = readSync(fd, head, 0, prefix, 0);
    return read === prefix && head.toString('utf8') === LFS_POINTER_PREFIX;
  } finally {
    closeSync(fd);
  }
}

/**
 * True when the artifact is present and holds its real bytes, not a pointer.
 *
 * Real-artifact tests skip on `!isFetched(path)` so a fresh local clone runs
 * clean. That does not let CI skip them silently: `.github/scripts/
 * lfs-pull-changed.sh` fetches every intake spreadsheet and fails the run if
 * one is still a pointer afterwards.
 */
export function isFetched(path: string): boolean {
  return existsSync(path) && !isLfsPointer(path);
}
