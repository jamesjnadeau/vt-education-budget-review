/**
 * Writing a throwaway file the intake CLI hands to `git` or `gh` (a commit
 * message, a PR body, a comment body).
 *
 * These go through a file rather than a command-line argument on purpose: it is
 * how issue-derived text reaches git and gh without ever touching a shell. The
 * directory they live in is gitignored and may not exist on a fresh CI checkout,
 * so every write ensures it first -- a missing directory once threw ENOENT on
 * the success path and failed the whole run after the document had already been
 * downloaded and validated.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ensures `dir` exists, writes `contents` to `dir/name`, and returns the path. */
export function writeScratchFile(dir: string, name: string, contents: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, contents, 'utf8');
  return path;
}
