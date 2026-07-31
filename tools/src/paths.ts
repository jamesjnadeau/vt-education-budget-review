import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Repository root, resolved from this file's location rather than cwd. */
export const REPO_ROOT = resolve(here, '..', '..');

export const PATHS = {
  registry: join(REPO_ROOT, 'registry'),
  registryEntities: join(REPO_ROOT, 'registry', 'entities'),
  registryRaw: join(REPO_ROOT, 'registry', 'raw'),
  groupings: join(REPO_ROOT, 'registry', 'groupings.yaml'),
  intake: join(REPO_ROOT, 'intake'),
  warehouse: join(REPO_ROOT, 'warehouse'),
  /** Committed derived products: computed here, never retrieved. */
  derived: join(REPO_ROOT, 'derived'),
  schemas: join(REPO_ROOT, 'schemas'),
  collectors: join(REPO_ROOT, 'collectors'),
  parameters: join(REPO_ROOT, 'model', 'parameters'),
  goldens: join(REPO_ROOT, 'model', 'goldens'),
  build: join(REPO_ROOT, 'build'),
  siteData: join(REPO_ROOT, 'site', 'public', 'data'),
  siteGenerated: join(REPO_ROOT, 'site', 'src', 'generated'),
} as const;

export function rel(absolute: string): string {
  return absolute.startsWith(REPO_ROOT) ? absolute.slice(REPO_ROOT.length + 1) : absolute;
}
