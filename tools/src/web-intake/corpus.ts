import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'yaml';

/**
 * Repo-relative path of an existing artifact whose recorded sha256 matches, or
 * null. Walks `intakeRoot` for `provenance.yaml` files without following
 * symlinks, and skips any file that cannot be read or parsed.
 */
export function findDuplicate(sha256: string, intakeRoot: string): string | null {
  const repoRoot = dirname(intakeRoot);
  const wanted = sha256.toLowerCase();

  const walk = (dir: string): string | null => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        const hit = walk(full);
        if (hit) return hit;
      } else if (e.isFile() && e.name === 'provenance.yaml') {
        const hit = matchIn(full);
        if (hit) return hit;
      }
    }
    return null;
  };

  const matchIn = (path: string): string | null => {
    let doc: unknown;
    try {
      doc = parse(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
    const artifacts = (doc as { artifacts?: unknown } | null)?.artifacts;
    if (!Array.isArray(artifacts)) return null;
    for (const a of artifacts) {
      if (!a || typeof a !== 'object') continue;
      const { sha256: sha, file } = a as { sha256?: unknown; file?: unknown };
      if (typeof sha === 'string' && typeof file === 'string' && sha.toLowerCase() === wanted) {
        return relative(repoRoot, join(dirname(path), file));
      }
    }
    return null;
  };

  return walk(intakeRoot);
}

/** A message when something already exists at `targetPath`, else null. */
export function collisionError(targetPath: string): string | null {
  try {
    lstatSync(targetPath);
  } catch {
    return null;
  }
  return `A file already exists at ${targetPath}. Rename the upload or check whether it was already submitted.`;
}
