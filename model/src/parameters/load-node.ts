/**
 * Node-only parameter file loading.
 *
 * Kept out of the engine's main entry point so that importing the engine in a
 * browser bundle never pulls in `node:fs`. The site build reads parameter
 * files here and embeds the parsed result as JSON.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { parseParameterSet } from './parse.ts';
import type { ParameterSet } from '../types.ts';

export function loadParameterFile(path: string): ParameterSet {
  const text = readFileSync(path, 'utf8');
  const doc = parseYaml(text) as unknown;
  return parseParameterSet(doc);
}

/** Every parameter file in a directory, newest fiscal year first. */
export function listParameterFiles(dir: string): Array<{ path: string; fiscalYear: number }> {
  return readdirSync(dir)
    .filter((f) => /^fy\d{4}\.yaml$/.test(f))
    .map((f) => ({ path: join(dir, f), fiscalYear: Number(f.slice(2, 6)) }))
    .sort((a, b) => b.fiscalYear - a.fiscalYear);
}
