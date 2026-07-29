import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir` matching `predicate`, depth-first, sorted. */
export function walkFiles(dir: string, predicate: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...walkFiles(path, predicate));
    } else if (predicate(entry)) {
      out.push(path);
    }
  }
  return out;
}
