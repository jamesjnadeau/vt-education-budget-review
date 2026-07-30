import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type { ErrorObject, Options } from 'ajv';
import type { Ajv2020 } from 'ajv/dist/2020.js';

import { PATHS } from '../paths.ts';

// ajv and ajv-formats are CommonJS with an `export =` shape, which cannot be
// default-imported from an ES module under verbatimModuleSyntax. createRequire
// loads them the way Node actually will at runtime, and the types come in
// separately as type-only imports.
const require = createRequire(import.meta.url);

type AjvConstructor = new (options?: Options) => Ajv2020;

const ajvModule = require('ajv/dist/2020.js') as { default?: AjvConstructor } & AjvConstructor;
const AjvCtor: AjvConstructor = ajvModule.default ?? ajvModule;

const formatsModule = require('ajv-formats') as {
  default?: (instance: Ajv2020) => void;
} & ((instance: Ajv2020) => void);
const addFormats = formatsModule.default ?? formatsModule;

export type SchemaName =
  | 'budget'
  | 'registry'
  | 'provenance'
  | 'collector'
  | 'parameters'
  | 'grouping'
  | 'mapping'
  | 'adm'
  | 'aoe-source';

const SCHEMA_IDS: Readonly<Record<SchemaName, string>> = {
  budget: 'urn:vt-budget:schema:budget:1.0',
  registry: 'urn:vt-budget:schema:registry:1.0',
  provenance: 'urn:vt-budget:schema:provenance:1.0',
  collector: 'urn:vt-budget:schema:collector:1.0',
  parameters: 'urn:vt-budget:schema:parameters:1.0',
  grouping: 'urn:vt-budget:schema:grouping:1.0',
  mapping: 'urn:vt-budget:schema:mapping:1.0',
  adm: 'urn:vt-budget:schema:adm:1.0',
  'aoe-source': 'urn:vt-budget:schema:aoe-source:1.0',
};

export interface SchemaError {
  readonly path: string;
  readonly message: string;
}

let cached: Ajv2020 | null = null;

function ajv(): Ajv2020 {
  if (cached) return cached;

  const instance = new AjvCtor({
    allErrors: true,
    strict: false,
    // Defaults declared in the schemas document intent for a human reader.
    // Filling them in silently would let an omitted field masquerade as a
    // deliberate one, which is the opposite of what this repo is for.
    useDefaults: false,
  });
  addFormats(instance);

  for (const file of readdirSync(PATHS.schemas)) {
    if (!file.endsWith('.schema.json')) continue;
    instance.addSchema(JSON.parse(readFileSync(join(PATHS.schemas, file), 'utf8')));
  }

  cached = instance;
  return instance;
}

export function validateAgainst(schema: SchemaName, data: unknown): SchemaError[] {
  const validate = ajv().getSchema(SCHEMA_IDS[schema]);
  if (!validate) throw new Error(`Schema "${schema}" (${SCHEMA_IDS[schema]}) is not loaded.`);

  if (validate(data)) return [];

  return (validate.errors ?? []).map((e: ErrorObject) => ({
    path: e.instancePath || '/',
    message: `${e.message ?? 'is invalid'}${e.params && Object.keys(e.params).length > 0 ? ` (${JSON.stringify(e.params)})` : ''}`,
  }));
}
