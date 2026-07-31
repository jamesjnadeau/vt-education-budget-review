# Registry Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a human correct a wrong AOE-published registry value with tiered evidence, apply it through the sync, retire it automatically when AOE agrees, and export the open set as a markdown report and CSV that someone at AOE can act on.

**Architecture:** One authored file, `registry/corrections.yaml`, is the source of truth. `tools/src/registry/corrections.ts` holds the pure logic — the field-tier table, `upstreamState`, and `applyCorrections` — which `normalizeSnapshot` calls in place of the current `applyOverrides`. Each entity's `manual_overrides` becomes generated output and a new `aoe_published` map records what AOE says for corrected fields. A validator rule and a two-format export CLI both read the register.

**Tech Stack:** TypeScript (ESM, `.ts` extensions in import specifiers), Node built-ins, the `yaml` package (already a dependency), ajv for schema validation, vitest for tests.

Spec: [`docs/superpowers/specs/2026-07-31-registry-corrections-design.md`](../specs/2026-07-31-registry-corrections-design.md)

## Global Constraints

- **No new dependencies.** `yaml`, `ajv`, `ajv-formats` are present; nothing else may be added.
- **Import specifiers carry the `.ts` extension** (`from '../paths.ts'`) — this repo runs TypeScript directly under `tsx`.
- **All interface fields are `readonly`.** Every existing type in `tools/src/registry/types.ts` does this.
- **Never let a null mean "unknown" ambiguously** (`CONTRIBUTING.md`). A correction whose value is genuinely absent uses `null`; code must distinguish "AOE published nothing" from "we have not checked".
- **Never make the engine estimate.** No fallback values, no "reasonable default" for a missing correction field.
- **Comments explain why, not what.** Match the density and voice of `tools/src/registry/sync.ts`.
- **Nothing that leaves the repo contains a repo slug.** The markdown report and the CSV are keyed on AOE's `OrgID` and organization name.
- **Never fabricate evidence.** No step may write an `observation`, `quote`, or `retrieved` date describing a retrieval that was not performed. If a value cannot be verified in the execution environment, stop and say so.
- All three must pass before any commit that closes a task: `npm test`, `npm run typecheck`, `npm run validate`.

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `schemas/corrections-1.0.schema.json` | Shape of the register. |
| `registry/corrections.yaml` | The authored register. |
| `tools/src/registry/corrections.ts` | Types, field tiers, `readCorrections`, `upstreamState`, `applyCorrections`. Pure except `readCorrections`. |
| `tools/src/registry/corrections.test.ts` | Tests for the above. |
| `tools/src/registry/corrections-report.ts` | `buildReport` and `buildCsv`. Pure. |
| `tools/src/registry/corrections-report.test.ts` | Tests for the above. |
| `tools/src/cli/registry-corrections.ts` | The `--report` / `--csv` entry point. |

**Modify:**

| Path | Change |
|---|---|
| `tools/src/paths.ts` | Add `corrections` and `derivedCorrections` paths. |
| `tools/src/registry/types.ts` | Add `aoe_published` to `RegistryEntity`. |
| `schemas/registry-1.0.schema.json` | Add `aoe_published`; document `manual_overrides` as generated. |
| `tools/src/registry/sync.ts` | Replace `applyOverrides` with `applyCorrections`; accept corrections in `NormalizeOptions`. |
| `tools/src/cli/registry-sync.ts` | Load the register and pass it through. |
| `tools/src/validate/schemas.ts` | Register the `corrections` schema name. |
| `tools/src/validate/rules.ts` | Add `checkCorrections`. |
| `tools/src/cli/validate.ts` | Wire `checkCorrections` in. |
| `package.json` | Add the `registry:corrections` script. |

---

## Task 1: The register — schema, types, and loader

**Files:**
- Create: `schemas/corrections-1.0.schema.json`
- Create: `tools/src/registry/corrections.ts`
- Create: `tools/src/registry/corrections.test.ts`
- Create: `registry/corrections.yaml`
- Modify: `tools/src/paths.ts`
- Modify: `tools/src/validate/schemas.ts:26-53`

**Interfaces:**
- Consumes: `PATHS` and `rel` from `tools/src/paths.ts`; `SchemaName` from `tools/src/validate/schemas.ts`.
- Produces: everything below. Later tasks depend on these exact names.

```ts
export type CorrectionStatus = 'open' | 'sent' | 'withdrawn';
export type UpstreamState = 'adopted' | 'outstanding' | 'diverged';
export type EvidenceClass = 'retrieved_url' | 'cited_document' | 'derived_artifact';
export type FieldClass = 'contact' | 'identity' | 'structural' | 'spatial';
export type CorrectionValue = string | number | null | readonly string[];

export interface Correction {
  readonly slug: string;
  readonly field: string;
  readonly aoe_value: CorrectionValue;
  readonly aoe_value_observed: string;
  readonly our_value: CorrectionValue;
  readonly evidence: Evidence;
  readonly submitted_by: string;
  readonly submitted_date: string;
  readonly status: CorrectionStatus;
  readonly sent_date: string | null;
  readonly note: string | null;
}

export interface CorrectionsFile {
  readonly schema_version: '1.0';
  readonly corrections: readonly Correction[];
}

export const FIELD_CLASS: Readonly<Record<string, FieldClass>>;
export const EVIDENCE_FOR_CLASS: Readonly<Record<FieldClass, readonly EvidenceClass[]>>;
export function valuesEqual(a: CorrectionValue, b: CorrectionValue): boolean;
export function readCorrections(): CorrectionsFile;
export function correctionsBySlug(cs: readonly Correction[]): Map<string, Correction[]>;
```

- [ ] **Step 1: Write the failing test**

Create `tools/src/registry/corrections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { EVIDENCE_FOR_CLASS, FIELD_CLASS, correctionsBySlug, valuesEqual } from './corrections.ts';
import type { Correction } from './corrections.ts';

function correction(over: Partial<Correction> = {}): Correction {
  return {
    slug: 'su/addison-central',
    field: 'website',
    aoe_value: 'http://old.example.invalid/',
    aoe_value_observed: '2026-07-29',
    our_value: 'https://new.example.invalid/',
    evidence: {
      class: 'retrieved_url',
      url: 'https://new.example.invalid/',
      retrieved: '2026-07-31',
      observation: 'Serves the district site.',
    },
    submitted_by: 'Tester',
    submitted_date: '2026-07-31',
    status: 'open',
    sent_date: null,
    note: null,
    ...over,
  };
}

describe('the field tier table', () => {
  it('is the whitelist: a field absent from it is not correctable', () => {
    expect(FIELD_CLASS['website']).toBe('contact');
    expect(FIELD_CLASS['operated_by']).toBe('structural');
    expect(FIELD_CLASS['aoe_org_id']).toBeUndefined();
    expect(FIELD_CLASS['slug']).toBeUndefined();
  });

  it('demands a cited document wherever a wrong value would move model output', () => {
    expect(EVIDENCE_FOR_CLASS['structural']).toEqual(['cited_document']);
    expect(EVIDENCE_FOR_CLASS['identity']).toEqual(['cited_document']);
    expect(EVIDENCE_FOR_CLASS['contact']).toEqual(['retrieved_url']);
    expect(EVIDENCE_FOR_CLASS['spatial']).toEqual(['cited_document', 'derived_artifact']);
  });
});

describe('valuesEqual', () => {
  it('compares list-valued fields by content, not identity', () => {
    expect(valuesEqual(['town/a', 'town/b'], ['town/a', 'town/b'])).toBe(true);
    expect(valuesEqual(['town/a'], ['town/a', 'town/b'])).toBe(false);
  });

  it('does not treat null and the empty string as the same absence', () => {
    expect(valuesEqual(null, '')).toBe(false);
    expect(valuesEqual(null, null)).toBe(true);
  });
});

describe('correctionsBySlug', () => {
  it('groups every correction under its entity, preserving file order', () => {
    const grouped = correctionsBySlug([
      correction({ field: 'website' }),
      correction({ field: 'name', our_value: 'A' }),
      correction({ slug: 'town/calais' }),
    ]);
    expect(grouped.get('su/addison-central')?.map((c) => c.field)).toEqual(['website', 'name']);
    expect(grouped.get('town/calais')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tools/src/registry/corrections.test.ts`
Expected: FAIL — `Cannot find module './corrections.ts'`.

- [ ] **Step 3: Write `tools/src/registry/corrections.ts`**

```ts
/**
 * The corrections register: values this project asserts against what AOE
 * publishes, with the evidence for each.
 *
 * A correction is a CLAIM ABOUT A NAMED SOURCE, not a local edit. It records
 * the value AOE published at the time the claim was made, so the sync can later
 * ask the only question that matters -- does AOE still publish the thing we
 * objected to? -- and retire the claim when the answer becomes no. An override
 * that cannot retire is how a mirror silently stops being a mirror.
 *
 * Evidence is tiered by what the field can break, not by how much trouble it is
 * to gather. A wrong `website` is cosmetic. A wrong `operated_by` changes which
 * districts serve which towns, which the whole modelling tool keys off, so it
 * carries the burden `docs/parameter-verification.md` puts on a statutory
 * weight: a document and the operative sentence, quoted.
 */

import { existsSync, readFileSync } from 'node:fs';

import { parse as parseYaml } from 'yaml';

import { PATHS } from '../paths.ts';

export type CorrectionStatus = 'open' | 'sent' | 'withdrawn';

/**
 * Computed each sync, never authored. Storing "adopted" by hand would mean
 * maintaining a fact about AOE's data inside a file AOE never touches.
 */
export type UpstreamState = 'adopted' | 'outstanding' | 'diverged';

export type EvidenceClass = 'retrieved_url' | 'cited_document' | 'derived_artifact';
export type FieldClass = 'contact' | 'identity' | 'structural' | 'spatial';

/** Registry field values a correction can carry. `member_towns` is the list case. */
export type CorrectionValue = string | number | null | readonly string[];

export interface RetrievedUrlEvidence {
  readonly class: 'retrieved_url';
  readonly url: string;
  readonly retrieved: string;
  readonly observation: string;
}

export interface CitedDocumentEvidence {
  readonly class: 'cited_document';
  readonly document: string;
  readonly document_url: string | null;
  readonly document_path: string | null;
  readonly retrieved: string;
  /** The operative sentence, verbatim. Not a summary -- see the module header. */
  readonly quote: string;
}

export interface DerivedArtifactEvidence {
  readonly class: 'derived_artifact';
  readonly path: string;
  readonly provenance_sha256: string;
  readonly observation: string;
}

export type Evidence = RetrievedUrlEvidence | CitedDocumentEvidence | DerivedArtifactEvidence;

export interface Correction {
  readonly slug: string;
  readonly field: string;
  /** What AOE published when this claim was made. The claim's premise. */
  readonly aoe_value: CorrectionValue;
  /** The snapshot that premise was read from, so a stale claim is distinguishable from a wrong one. */
  readonly aoe_value_observed: string;
  readonly our_value: CorrectionValue;
  readonly evidence: Evidence;
  readonly submitted_by: string;
  readonly submitted_date: string;
  readonly status: CorrectionStatus;
  readonly sent_date: string | null;
  readonly note: string | null;
}

export interface CorrectionsFile {
  readonly schema_version: '1.0';
  readonly corrections: readonly Correction[];
}

/**
 * The correctable-field whitelist AND the tier table, deliberately one object.
 * A field absent here cannot be corrected, so widening the surface is an edit to
 * this table rather than a side effect of writing a correction. Identity keys
 * (`slug`, `aoe_org_id`, `type`) are absent on purpose: you cannot correct the
 * thing that identifies the record.
 */
export const FIELD_CLASS: Readonly<Record<string, FieldClass>> = {
  website: 'contact',
  mailing_city: 'contact',
  name: 'identity',
  supervisory_union: 'structural',
  operated_by: 'structural',
  member_towns: 'structural',
  latitude: 'spatial',
  longitude: 'spatial',
  municipality: 'spatial',
};

export const EVIDENCE_FOR_CLASS: Readonly<Record<FieldClass, readonly EvidenceClass[]>> = {
  contact: ['retrieved_url'],
  identity: ['cited_document'],
  structural: ['cited_document'],
  // `derived_artifact` exists because derived/school-municipality/ already
  // computes municipality by point-in-polygon with its own provenance. A
  // spatial correction should cite that computation, not re-argue it in prose.
  spatial: ['cited_document', 'derived_artifact'],
};

export function valuesEqual(a: CorrectionValue, b: CorrectionValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

export function correctionsBySlug(cs: readonly Correction[]): Map<string, Correction[]> {
  const out = new Map<string, Correction[]>();
  for (const c of cs) {
    const list = out.get(c.slug) ?? [];
    list.push(c);
    out.set(c.slug, list);
  }
  return out;
}

/** An absent register is not an error: most repos have no corrections yet. */
export function readCorrections(): CorrectionsFile {
  if (!existsSync(PATHS.corrections)) return { schema_version: '1.0', corrections: [] };
  const parsed = parseYaml(readFileSync(PATHS.corrections, 'utf8')) as CorrectionsFile | null;
  if (!parsed) return { schema_version: '1.0', corrections: [] };
  return { schema_version: '1.0', corrections: parsed.corrections ?? [] };
}
```

- [ ] **Step 4: Add the paths**

In `tools/src/paths.ts`, inside the `PATHS` object after the `groupings` line:

```ts
  corrections: join(REPO_ROOT, 'registry', 'corrections.yaml'),
```

and after the `derived` line:

```ts
  /** Reports and exports built for sending upstream. Not a data product. */
  derivedCorrections: join(REPO_ROOT, 'derived', 'corrections'),
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tools/src/registry/corrections.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the schema**

Create `schemas/corrections-1.0.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vt-budget:schema:corrections:1.0",
  "title": "Registry corrections",
  "description": "Values this project asserts against what AOE publishes, with evidence. Each record is a claim about a named source rather than a local edit: it carries the value AOE published when the claim was made, so the sync can retire the claim once AOE agrees. Evidence is tiered by what the field can break -- a website is cosmetic, an operated_by relationship moves model output -- and the tier is enforced by checkCorrections, not by this schema.",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "corrections"],
  "properties": {
    "schema_version": { "const": "1.0" },
    "corrections": {
      "type": "array",
      "items": { "$ref": "#/$defs/correction" }
    }
  },
  "$defs": {
    "value": {
      "description": "A registry field value. The array case is member_towns. Null means AOE published nothing, never 'we have not checked'.",
      "type": ["string", "number", "array", "null"],
      "items": { "type": "string" }
    },
    "correction": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "slug",
        "field",
        "aoe_value",
        "aoe_value_observed",
        "our_value",
        "evidence",
        "submitted_by",
        "submitted_date",
        "status"
      ],
      "properties": {
        "slug": { "$ref": "urn:vt-budget:schema:common:1.0#/$defs/entity_ref" },
        "field": { "type": "string", "minLength": 1 },
        "aoe_value": { "$ref": "#/$defs/value" },
        "aoe_value_observed": {
          "type": "string",
          "format": "date",
          "description": "The registry/raw snapshot date aoe_value was read from."
        },
        "our_value": { "$ref": "#/$defs/value" },
        "evidence": {
          "oneOf": [
            { "$ref": "#/$defs/retrieved_url" },
            { "$ref": "#/$defs/cited_document" },
            { "$ref": "#/$defs/derived_artifact" }
          ]
        },
        "submitted_by": { "type": "string", "minLength": 1 },
        "submitted_date": { "type": "string", "format": "date" },
        "status": {
          "enum": ["open", "sent", "withdrawn"],
          "description": "The only human-authored states. adopted/outstanding/diverged are computed each sync by comparing what AOE now publishes against aoe_value and our_value."
        },
        "sent_date": { "type": ["string", "null"], "format": "date", "default": null },
        "note": { "type": ["string", "null"], "default": null }
      }
    },
    "retrieved_url": {
      "type": "object",
      "additionalProperties": false,
      "required": ["class", "url", "retrieved", "observation"],
      "properties": {
        "class": { "const": "retrieved_url" },
        "url": { "type": "string", "format": "uri" },
        "retrieved": { "type": "string", "format": "date" },
        "observation": {
          "type": "string",
          "minLength": 1,
          "description": "What the retrieval actually returned. Never a description of a retrieval nobody performed."
        }
      }
    },
    "cited_document": {
      "type": "object",
      "additionalProperties": false,
      "required": ["class", "document", "retrieved", "quote"],
      "properties": {
        "class": { "const": "cited_document" },
        "document": { "type": "string", "minLength": 1 },
        "document_url": { "type": ["string", "null"], "format": "uri", "default": null },
        "document_path": { "type": ["string", "null"], "default": null },
        "retrieved": { "type": "string", "format": "date" },
        "quote": {
          "type": "string",
          "minLength": 1,
          "description": "The operative sentence, verbatim. Not a summary -- the same standard docs/parameter-verification.md sets for a statutory parameter."
        }
      }
    },
    "derived_artifact": {
      "type": "object",
      "additionalProperties": false,
      "required": ["class", "path", "provenance_sha256", "observation"],
      "properties": {
        "class": { "const": "derived_artifact" },
        "path": { "type": "string", "minLength": 1 },
        "provenance_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "observation": { "type": "string", "minLength": 1 }
      }
    }
  }
}
```

- [ ] **Step 7: Register the schema name**

In `tools/src/validate/schemas.ts`, add `| 'corrections'` to the `SchemaName` union (line ~26), and add to `SCHEMA_IDS`:

```ts
  corrections: 'urn:vt-budget:schema:corrections:1.0',
```

- [ ] **Step 8: Create the empty register**

Create `registry/corrections.yaml`:

```yaml
# Values this project asserts against what AOE publishes, with the evidence.
#
# A record here is a CLAIM ABOUT A NAMED SOURCE, not a local edit. It says "AOE
# currently publishes X, and X is wrong, and here is why" -- a premise that can
# be checked and a status that resolves itself when AOE comes to agree.
#
# `status` is one of open | sent | withdrawn, and those are the ONLY values a
# human writes. Whether AOE has adopted a correction is computed each sync by
# comparing what they publish now against `aoe_value` and `our_value`.
#
# Evidence is tiered by what the field can break. See FIELD_CLASS in
# tools/src/registry/corrections.ts; `npm run validate` enforces it.
schema_version: "1.0"
corrections: []
```

- [ ] **Step 9: Verify the whole suite still passes**

Run: `npm test && npm run typecheck && npm run validate`
Expected: all pass. `validate` is unchanged in behaviour — nothing reads the register yet.

- [ ] **Step 10: Commit**

```bash
git add schemas/corrections-1.0.schema.json registry/corrections.yaml \
        tools/src/registry/corrections.ts tools/src/registry/corrections.test.ts \
        tools/src/paths.ts tools/src/validate/schemas.ts
git commit -m "Define a corrections register: a claim against a named source"
```

---

## Task 2: `upstreamState` — the lifecycle, as a pure function

**Files:**
- Modify: `tools/src/registry/corrections.ts`
- Modify: `tools/src/registry/corrections.test.ts`

**Interfaces:**
- Consumes: `Correction`, `CorrectionValue`, `valuesEqual`, `UpstreamState` from Task 1.
- Produces: `export function upstreamState(c: Correction, aoeValue: CorrectionValue): UpstreamState`

- [ ] **Step 1: Write the failing test**

Append to `tools/src/registry/corrections.test.ts` (the `correction()` helper from Task 1 is already in scope; add `upstreamState` to the import from `./corrections.ts`):

```ts
describe('upstreamState', () => {
  it('is adopted once AOE publishes the value we asserted', () => {
    expect(upstreamState(correction(), 'https://new.example.invalid/')).toBe('adopted');
  });

  it('is outstanding while AOE still publishes what we objected to', () => {
    expect(upstreamState(correction(), 'http://old.example.invalid/')).toBe('outstanding');
  });

  it('is diverged when AOE has moved to some third value', () => {
    expect(upstreamState(correction(), 'https://third.example.invalid/')).toBe('diverged');
  });

  it('treats AOE dropping the field entirely as divergence, not adoption', () => {
    // Null is not agreement. Reading it as adoption would retire a correction
    // because the source went silent, which is the opposite of the source agreeing.
    expect(upstreamState(correction(), null)).toBe('diverged');
  });

  it('compares list-valued fields by content', () => {
    const c = correction({
      field: 'member_towns',
      aoe_value: ['town/a'],
      our_value: ['town/a', 'town/b'],
    });
    expect(upstreamState(c, ['town/a', 'town/b'])).toBe('adopted');
    expect(upstreamState(c, ['town/a'])).toBe('outstanding');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tools/src/registry/corrections.test.ts`
Expected: FAIL — `upstreamState is not a function` (or a TS import error).

- [ ] **Step 3: Implement it**

Append to `tools/src/registry/corrections.ts`:

```ts
/**
 * Where a correction stands with AOE, computed from what they publish now.
 *
 * Adoption is checked BEFORE outstanding on purpose. If a correction were ever
 * written with `aoe_value` equal to `our_value` it would be a no-op claim, and
 * reporting it as outstanding forever would be the more confusing of the two
 * wrong answers.
 */
export function upstreamState(c: Correction, aoeValue: CorrectionValue): UpstreamState {
  if (valuesEqual(aoeValue, c.our_value)) return 'adopted';
  if (valuesEqual(aoeValue, c.aoe_value)) return 'outstanding';
  return 'diverged';
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tools/src/registry/corrections.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/src/registry/corrections.ts tools/src/registry/corrections.test.ts
git commit -m "Compute where a correction stands with AOE"
```

---

## Task 3: `applyCorrections`, and the sync stops pinning fields forever

**Files:**
- Modify: `tools/src/registry/corrections.ts`
- Modify: `tools/src/registry/corrections.test.ts`
- Modify: `tools/src/registry/types.ts:60-82`
- Modify: `schemas/registry-1.0.schema.json:156-175`
- Modify: `tools/src/registry/sync.ts` (delete `applyOverrides` at 335-346; change `NormalizeOptions` at ~30-36, entity construction at ~259, and the final map at ~322)
- Modify: `tools/src/cli/registry-sync.ts:107`

**Interfaces:**
- Consumes: `Correction`, `upstreamState`, `valuesEqual`, `correctionsBySlug` from Tasks 1-2; `RegistryEntity`, `ManualOverride` from `tools/src/registry/types.ts`.
- Produces:
  - `RegistryEntity` gains `readonly aoe_published?: Readonly<Record<string, CorrectionValue>>`
  - `export function applyCorrections(entity: RegistryEntity, corrections: readonly Correction[]): RegistryEntity`
  - `export function evidenceSummary(e: Evidence): string`
  - `NormalizeOptions` gains `readonly corrections?: readonly Correction[]`

- [ ] **Step 1: Write the failing test**

Append to `tools/src/registry/corrections.test.ts`. Add `applyCorrections` and `evidenceSummary` to the import, and add these imports at the top of the file:

```ts
import type { RegistryEntity } from './types.ts';
```

```ts
function entity(over: Partial<RegistryEntity> = {}): RegistryEntity {
  return {
    slug: 'su/addison-central',
    name: 'Addison Central Supervisory District',
    type: 'su',
    aoe_org_id: 'SU003',
    aoe_server_id: 6,
    edfi_id: 9003,
    effective_from: '2026-07-29',
    effective_from_basis: 'first_observed',
    effective_to: null,
    effective_to_basis: 'unknown',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    member_towns: [],
    grades: [],
    website: 'http://old.example.invalid/',
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...over,
  };
}

describe('applyCorrections', () => {
  it('asserts our value over what AOE published, and keeps both figures', () => {
    const result = applyCorrections(entity(), [correction()]);
    expect(result.website).toBe('https://new.example.invalid/');
    expect(result.aoe_published?.['website']).toBe('http://old.example.invalid/');
  });

  it('generates the manual_overrides entry rather than trusting a hand-written one', () => {
    const result = applyCorrections(entity({ manual_overrides: [
      { field: 'name', reason: 'stale hand edit', set_by: 'nobody', set_date: '2020-01-01' },
    ] }), [correction()]);
    expect(result.manual_overrides).toHaveLength(1);
    expect(result.manual_overrides[0]?.field).toBe('website');
    expect(result.manual_overrides[0]?.set_by).toBe('Tester');
  });

  it('retires the correction once AOE agrees, WITHOUT changing any value', () => {
    // The whole claim of the lifecycle design: adoption is not a data change,
    // because the two values are already equal. We simply stop asserting it.
    const agreed = entity({ website: 'https://new.example.invalid/' });
    const result = applyCorrections(agreed, [correction()]);
    expect(result).toEqual(agreed);
  });

  it('holds the corrected value when AOE diverges, rather than silently deferring', () => {
    const moved = entity({ website: 'https://third.example.invalid/' });
    const result = applyCorrections(moved, [correction()]);
    expect(result.website).toBe('https://new.example.invalid/');
    expect(result.aoe_published?.['website']).toBe('https://third.example.invalid/');
  });

  it('does not apply a withdrawn correction, or record it as published', () => {
    const result = applyCorrections(entity(), [correction({ status: 'withdrawn' })]);
    expect(result.website).toBe('http://old.example.invalid/');
    expect(result.aoe_published).toEqual({});
    expect(result.manual_overrides).toEqual([]);
  });

  it('is idempotent: applying to its own output changes nothing further', () => {
    const once = applyCorrections(entity(), [correction()]);
    // Re-running the sync must not treat our own asserted value as AOE adoption.
    // The second pass sees website already corrected, which reads as adopted --
    // so callers must always apply to a freshly normalized entity. This test
    // pins that the function is total and does not throw or double-append.
    const twice = applyCorrections(once, [correction()]);
    expect(twice.manual_overrides.length).toBeLessThanOrEqual(1);
  });
});

describe('evidenceSummary', () => {
  it('renders a retrieval as a checkable one-liner', () => {
    expect(evidenceSummary(correction().evidence)).toBe(
      'Retrieved https://new.example.invalid/ on 2026-07-31: Serves the district site.',
    );
  });

  it('puts the quoted sentence in front for a cited document', () => {
    const summary = evidenceSummary({
      class: 'cited_document',
      document: 'ACSD Board minutes',
      document_url: 'https://example.invalid/minutes.pdf',
      document_path: null,
      retrieved: '2026-07-31',
      quote: 'The Board voted to adopt the name Addison Central School District.',
    });
    expect(summary).toContain('"The Board voted to adopt the name Addison Central School District."');
    expect(summary).toContain('ACSD Board minutes');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tools/src/registry/corrections.test.ts`
Expected: FAIL — `applyCorrections is not a function`.

- [ ] **Step 3: Add `aoe_published` to the entity type**

In `tools/src/registry/types.ts`, add to `RegistryEntity` immediately above `manual_overrides`:

```ts
  /**
   * What AOE publishes for each field currently under correction.
   *
   * Both figures are kept and never reconciled, the same way a budget record
   * keeps a district's printed per-pupil figure alongside our recomputation.
   * A field disappears from here the moment AOE adopts the correction, which is
   * what "the override retires itself" means in the data.
   */
  readonly aoe_published?: Readonly<Record<string, string | number | null | readonly string[]>>;
```

- [ ] **Step 4: Implement `applyCorrections`**

Append to `tools/src/registry/corrections.ts`, adding `ManualOverride` and `RegistryEntity` to the type imports:

```ts
import type { ManualOverride, RegistryEntity } from './types.ts';

export function evidenceSummary(e: Evidence): string {
  switch (e.class) {
    case 'retrieved_url':
      return `Retrieved ${e.url} on ${e.retrieved}: ${e.observation}`;
    case 'cited_document': {
      const where = e.document_url ?? e.document_path ?? 'no locator recorded';
      return `${e.document} (${where}), retrieved ${e.retrieved}: "${e.quote}"`;
    }
    case 'derived_artifact':
      return `Derived at ${e.path} (sha256 ${e.provenance_sha256.slice(0, 12)}…): ${e.observation}`;
  }
}

/**
 * Applies the register to a freshly normalized entity.
 *
 * MUST be given an entity carrying AOE's values, straight from the snapshot.
 * Given an already-corrected entity it would read our own assertion as AOE
 * agreement and retire the correction -- which is exactly why this replaced the
 * old `applyOverrides`, whose habit of reading the previous registry state is
 * what made overrides immortal.
 */
export function applyCorrections(
  entity: RegistryEntity,
  corrections: readonly Correction[],
): RegistryEntity {
  const next = { ...entity } as Record<string, unknown>;
  const published: Record<string, CorrectionValue> = {};
  const overrides: ManualOverride[] = [];

  for (const c of corrections) {
    if (c.status === 'withdrawn') continue;

    const aoeValue = entity[c.field as keyof RegistryEntity] as CorrectionValue;
    if (upstreamState(c, aoeValue) === 'adopted') continue;

    next[c.field] = c.our_value;
    published[c.field] = aoeValue;
    overrides.push({
      field: c.field,
      reason: `Corrected against AOE's published value. ${evidenceSummary(c.evidence)}`,
      set_by: c.submitted_by,
      set_date: c.submitted_date,
    });

    // Correcting a municipality must move its basis too, or the basis goes on
    // claiming a point-in-polygon provenance the value no longer has.
    if (c.field === 'municipality') {
      next['municipality_basis'] = c.evidence.class === 'derived_artifact'
        ? 'census_geocoder_point_in_polygon'
        : 'manual';
    }
  }

  // Written unconditionally so an entity whose last correction was adopted
  // loses its aoe_published map rather than keeping a stale one.
  next['aoe_published'] = published;
  next['manual_overrides'] = overrides;
  return next as unknown as RegistryEntity;
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tools/src/registry/corrections.test.ts`
Expected: PASS, 19 tests.

The `retires ... WITHOUT changing any value` test compares against an entity with no `aoe_published` key. `applyCorrections` writes `aoe_published: {}`. If `toEqual` fails on that, change the assertion to compare the fields rather than loosening the implementation:

```ts
    expect({ ...result, aoe_published: undefined }).toEqual({ ...agreed, aoe_published: undefined });
```

- [ ] **Step 6: Wire it into the sync**

In `tools/src/registry/sync.ts`:

Add to the imports:

```ts
import { applyCorrections, correctionsBySlug, type Correction } from './corrections.ts';
```

Add to `NormalizeOptions`:

```ts
  /** The corrections register. Applied last, over AOE's values. */
  readonly corrections?: readonly Correction[];
```

At the entity construction (~line 259), replace `manual_overrides: prior?.manual_overrides ?? [],` with:

```ts
      // Generated by applyCorrections below, never carried over: the register
      // is the source of truth for what a human has asserted.
      manual_overrides: [],
```

Replace the `applyOverrides` call block near line 322:

```ts
  // Re-apply manual overrides last. The API is a convenience layer, not a
  // dependency: a value a human set deliberately must survive the next sync.
  const entities = [...bySlug.values()].map((entity) => applyOverrides(entity, existingBySlug.get(entity.slug)));
```

with:

```ts
  // The register is applied last, over AOE's values. The API is a convenience
  // layer, not a dependency: a value a human asserted with evidence must
  // survive the next sync -- but only until AOE comes to agree with it, which
  // applyCorrections detects and retires on its own.
  const byCorrection = correctionsBySlug(options.corrections ?? []);
  const entities = [...bySlug.values()].map((entity) =>
    applyCorrections(entity, byCorrection.get(entity.slug) ?? []),
  );
```

Delete the entire `applyOverrides` function (lines 335-346).

- [ ] **Step 7: Pass the register from the sync CLI**

In `tools/src/cli/registry-sync.ts`, add the import:

```ts
import { readCorrections } from '../registry/corrections.ts';
```

and change the `normalizeSnapshot` call (~line 107) to:

```ts
  const register = readCorrections();
  if (register.corrections.length > 0) {
    console.log(`\nApplying ${register.corrections.length} correction(s) from registry/corrections.yaml.`);
  }
  const { entities, warnings, notTracked } = normalizeSnapshot(snapshot, {
    existing,
    today: date,
    corrections: register.corrections,
  });
```

- [ ] **Step 8: Add `aoe_published` to the registry schema**

In `schemas/registry-1.0.schema.json`, insert before the `manual_overrides` property:

```json
        "aoe_published": {
          "type": "object",
          "description": "What AOE publishes for each field currently under correction, kept alongside the corrected value rather than reconciled with it. A field leaves this map the moment AOE adopts the correction. Written by the sync from registry/corrections.yaml; do not hand-edit.",
          "additionalProperties": true,
          "default": {}
        },
```

and replace the `manual_overrides` description with:

```json
          "description": "GENERATED from registry/corrections.yaml by the sync -- do not hand-edit. One entry per correction currently in force, with the evidence summarized in `reason`. Entries disappear when AOE adopts the correction.",
```

- [ ] **Step 9: Verify the existing registry tests still pass**

Run: `npx vitest run tools/src/registry/ && npm run typecheck`
Expected: PASS. `tools/src/registry/registry.test.ts:297-309` asserts an override survives a sync. That test hand-writes `manual_overrides` on a prior entity, which is no longer the mechanism.

Rewrite that test to assert what the code now guarantees — pass a `Correction` through `normalizeSnapshot`'s new `corrections` option and assert the value survives and `aoe_published` records AOE's figure. Do not delete the test and do not weaken it to match the implementation; it is guarding the "a human's value survives the sync" promise, which still holds.

- [ ] **Step 10: Rebuild the registry from the existing snapshot and confirm no drift**

Run: `npm run registry:sync -- --from 2026-07-29 && git diff --stat registry/entities/`
Expected: every entity gains `"aoe_published": {}`, and nothing else changes. If any `website`, `name`, `operated_by` or `member_towns` value moves, stop — the register is empty, so nothing should.

- [ ] **Step 11: Full verification**

Run: `npm test && npm run typecheck && npm run validate`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add tools/src/registry/corrections.ts tools/src/registry/corrections.test.ts \
        tools/src/registry/types.ts tools/src/registry/sync.ts \
        tools/src/registry/registry.test.ts tools/src/cli/registry-sync.ts \
        schemas/registry-1.0.schema.json registry/entities/
git commit -m "Let a correction retire itself when AOE comes to agree"
```

---

## Task 4: `checkCorrections` — the register cannot rot quietly

**Files:**
- Modify: `tools/src/validate/rules.ts` (append; follow the existing `checkRegistryRefs` shape)
- Create: `tools/src/validate/corrections-rule.test.ts`
- Modify: `tools/src/cli/validate.ts` (imports at 27-39; add a register block after the registry block at 82-86)

**Interfaces:**
- Consumes: `Correction`, `FIELD_CLASS`, `EVIDENCE_FOR_CLASS`, `valuesEqual`, `upstreamState` from Tasks 1-2; `Finding`, `Severity` from `tools/src/validate/rules.ts`; `RegistryEntity`.
- Produces: `export function checkCorrections(corrections: readonly Correction[], file: string, registry: ReadonlyMap<string, RegistryEntity>): Finding[]`

**The five checks, and what each is for:**

| Rule id | Severity | Catches |
|---|---|---|
| `correction-unknown-entity` | error | A slug with no registry entity. |
| `correction-uncorrectable-field` | error | A field outside `FIELD_CLASS` — including identity keys. |
| `correction-evidence-tier` | error | Evidence too weak for the field's tier. |
| `correction-duplicate` | error | Two corrections claiming the same `(slug, field)`. |
| `correction-diverged` | error | AOE has moved to a third value; a human must resolve it. |
| `correction-unapplied` | warning | The register says one thing and the registry another — sync has not been run. |

**One deliberate departure from the spec.** The spec's fifth bullet asks the
validator to check `aoe_value` against the raw snapshot named by
`aoe_value_observed`. This plan checks it against the entity's `aoe_published`
map instead, which the sync writes from that same snapshot. The guarantee is
identical — a correction whose premise was never true still fails — but it costs
no snapshot re-reading and, more importantly, avoids re-implementing the
type-dependent `ParentOrg`/`OperatedBy` untangling that `sync.ts` warns against
reading directly. Doing it the spec's way would mean a second, independent
decoding of those fields, which is exactly the duplication the sync module header
exists to prevent.

- [ ] **Step 1: Write the failing test**

Create `tools/src/validate/corrections-rule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Correction } from '../registry/corrections.ts';
import type { RegistryEntity } from '../registry/types.ts';
import { checkCorrections } from './rules.ts';

function entity(over: Partial<RegistryEntity> = {}): RegistryEntity {
  return {
    slug: 'su/addison-central',
    name: 'Addison Central Supervisory District',
    type: 'su',
    aoe_org_id: 'SU003',
    aoe_server_id: 6,
    edfi_id: 9003,
    effective_from: '2026-07-29',
    effective_from_basis: 'first_observed',
    effective_to: null,
    effective_to_basis: 'unknown',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    member_towns: [],
    grades: [],
    website: 'https://new.example.invalid/',
    aoe_published: { website: 'http://old.example.invalid/' },
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...over,
  };
}

function correction(over: Partial<Correction> = {}): Correction {
  return {
    slug: 'su/addison-central',
    field: 'website',
    aoe_value: 'http://old.example.invalid/',
    aoe_value_observed: '2026-07-29',
    our_value: 'https://new.example.invalid/',
    evidence: {
      class: 'retrieved_url',
      url: 'https://new.example.invalid/',
      retrieved: '2026-07-31',
      observation: 'Serves the district site.',
    },
    submitted_by: 'Tester',
    submitted_date: '2026-07-31',
    status: 'open',
    sent_date: null,
    note: null,
    ...over,
  };
}

const FILE = 'registry/corrections.yaml';

function run(cs: readonly Correction[], e = entity()) {
  return checkCorrections(cs, FILE, new Map([[e.slug, e]]));
}

describe('checkCorrections', () => {
  it('passes a correction that is applied and still outstanding', () => {
    expect(run([correction()])).toEqual([]);
  });

  it('rejects a correction against an entity that does not exist', () => {
    const findings = run([correction({ slug: 'su/nowhere' })]);
    expect(findings.map((f) => f.rule)).toContain('correction-unknown-entity');
  });

  it('refuses to correct the field that identifies the record', () => {
    const findings = run([correction({ field: 'aoe_org_id', our_value: 'SU999' })]);
    expect(findings[0]?.rule).toBe('correction-uncorrectable-field');
    expect(findings[0]?.severity).toBe('error');
  });

  it('refuses a structural claim carrying only a retrieved URL', () => {
    // operated_by moves model output. A URL is not the standard for that.
    const findings = run([
      correction({ field: 'operated_by', aoe_value: null, our_value: 'ud/somewhere' }),
    ]);
    expect(findings.map((f) => f.rule)).toContain('correction-evidence-tier');
  });

  it('accepts a structural claim carrying a cited document', () => {
    const e = entity({
      operated_by: 'ud/somewhere',
      aoe_published: { operated_by: null },
    });
    const findings = run(
      [
        correction({
          field: 'operated_by',
          aoe_value: null,
          our_value: 'ud/somewhere',
          evidence: {
            class: 'cited_document',
            document: 'Act 170 merger order',
            document_url: 'https://example.invalid/order.pdf',
            document_path: null,
            retrieved: '2026-07-31',
            quote: 'The district shall be operated by the union district effective July 1, 2026.',
          },
        }),
      ],
      e,
    );
    expect(findings).toEqual([]);
  });

  it('errors when AOE has moved to a third value', () => {
    const e = entity({ aoe_published: { website: 'https://third.example.invalid/' } });
    const findings = run([correction()], e);
    expect(findings[0]?.rule).toBe('correction-diverged');
    expect(findings[0]?.severity).toBe('error');
  });

  it('warns, rather than errors, when the sync has simply not been run yet', () => {
    const e = entity({ website: 'http://old.example.invalid/', aoe_published: {} });
    const findings = run([correction()], e);
    expect(findings[0]?.rule).toBe('correction-unapplied');
    expect(findings[0]?.severity).toBe('warning');
  });

  it('says nothing about a correction AOE has adopted', () => {
    const e = entity({ website: 'https://new.example.invalid/', aoe_published: {} });
    expect(run([correction()], e)).toEqual([]);
  });

  it('catches two corrections claiming the same field', () => {
    const findings = run([correction(), correction({ our_value: 'https://other.invalid/' })]);
    expect(findings.map((f) => f.rule)).toContain('correction-duplicate');
  });

  it('ignores a withdrawn correction entirely', () => {
    const e = entity({ website: 'http://old.example.invalid/', aoe_published: {} });
    expect(run([correction({ status: 'withdrawn' })], e)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tools/src/validate/corrections-rule.test.ts`
Expected: FAIL — `checkCorrections` is not exported from `./rules.ts`.

- [ ] **Step 3: Implement the rule**

Append to `tools/src/validate/rules.ts`, and add to its imports:

```ts
import {
  EVIDENCE_FOR_CLASS,
  FIELD_CLASS,
  upstreamState,
  valuesEqual,
  type Correction,
  type CorrectionValue,
} from '../registry/corrections.ts';
```

```ts
// --------------------------------------------------------------------------
// The corrections register
// --------------------------------------------------------------------------

/**
 * Keeps the register honest about the source it makes claims against.
 *
 * The check that earns its keep is `correction-diverged`. When AOE moves a
 * corrected field to some THIRD value -- a genuine new website, a merger -- the
 * sync deliberately holds our value rather than silently deferring, because
 * discarding an evidence-backed assertion without telling anyone is how the old
 * override mechanism went wrong. Holding it is only safe if the build then
 * stops, so this errors and a human resolves it.
 */
export function checkCorrections(
  corrections: readonly Correction[],
  file: string,
  registry: ReadonlyMap<string, RegistryEntity>,
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const c of corrections) {
    if (c.status === 'withdrawn') continue;

    const key = `${c.slug}#${c.field}`;
    if (seen.has(key)) {
      findings.push({
        severity: 'error',
        file,
        rule: 'correction-duplicate',
        message:
          `two corrections claim ${key}. Which one is in force would depend on file order, ` +
          `and a claim whose meaning depends on where it sits in a list is not a claim.`,
      });
      continue;
    }
    seen.add(key);

    const entity = registry.get(c.slug);
    if (!entity) {
      findings.push({
        severity: 'error',
        file,
        rule: 'correction-unknown-entity',
        message: `"${c.slug}" is not a known registry entity. Run \`npm run registry:sync\` or correct the slug.`,
      });
      continue;
    }

    const fieldClass = FIELD_CLASS[c.field];
    if (!fieldClass) {
      findings.push({
        severity: 'error',
        file,
        rule: 'correction-uncorrectable-field',
        message:
          `"${c.field}" is not a correctable field. Correctable fields are ` +
          `${Object.keys(FIELD_CLASS).sort().join(', ')}. Identity keys are absent on purpose: ` +
          `you cannot correct the thing that identifies the record. To widen the surface, ` +
          `edit FIELD_CLASS in tools/src/registry/corrections.ts deliberately.`,
      });
      continue;
    }

    const allowed = EVIDENCE_FOR_CLASS[fieldClass];
    if (!allowed.includes(c.evidence.class)) {
      findings.push({
        severity: 'error',
        file,
        rule: 'correction-evidence-tier',
        message:
          `${key} is a ${fieldClass} field and carries ${c.evidence.class} evidence. ` +
          `It needs ${allowed.join(' or ')}. A wrong ${c.field} propagates into published ` +
          `figures, so it earns the burden of proof a statutory parameter earns.`,
      });
      continue;
    }

    const current = entity[c.field as keyof RegistryEntity] as CorrectionValue;
    const published = entity.aoe_published?.[c.field] as CorrectionValue | undefined;

    if (published === undefined) {
      // No published figure recorded: either the sync retired this correction
      // because AOE adopted it, or the sync has not run since it was written.
      if (valuesEqual(current, c.our_value)) continue;
      findings.push({
        severity: valuesEqual(current, c.aoe_value) ? 'warning' : 'error',
        file,
        rule: valuesEqual(current, c.aoe_value) ? 'correction-unapplied' : 'correction-diverged',
        message: valuesEqual(current, c.aoe_value)
          ? `${key} is not applied to the registry. Run \`npm run registry:sync\`.`
          : `${key}: the registry holds a value matching neither this correction nor the ` +
            `AOE value it claims to replace. Rebuild with \`npm run registry:sync\` and, ` +
            `if it persists, re-check the correction's premise.`,
      });
      continue;
    }

    if (upstreamState(c, published) === 'diverged') {
      findings.push({
        severity: 'error',
        file,
        rule: 'correction-diverged',
        message:
          `${key}: AOE now publishes a value matching neither the one this correction ` +
          `objected to nor the one it asserts. The corrected value is still in force, ` +
          `deliberately -- an evidence-backed assertion is not dropped silently -- but a ` +
          `human has to look. Re-check the field, then either update aoe_value and the ` +
          `evidence, or set status: withdrawn.`,
      });
      continue;
    }

    if (!valuesEqual(current, c.our_value)) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'correction-unapplied',
        message: `${key} is recorded but not applied to the registry. Run \`npm run registry:sync\`.`,
      });
    }
  }

  return findings;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tools/src/validate/corrections-rule.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire it into the validate CLI**

In `tools/src/cli/validate.ts`:

Add `checkCorrections,` to the import block from `'../validate/rules.ts'`, and add:

```ts
import { readCorrections } from '../registry/corrections.ts';
```

After the registry block (the `for` loop ending near line 86), insert:

```ts
  // --- corrections register -----------------------------------------------
  if (existsSync(PATHS.corrections)) {
    const register = readData(PATHS.corrections);
    findings.push(...schemaFindings('corrections', register, PATHS.corrections));
    findings.push(
      ...checkCorrections(
        (register as { corrections?: Correction[] }).corrections ?? [],
        rel(PATHS.corrections),
        registry,
      ),
    );
  }
```

Add the type import:

```ts
import type { Correction } from '../registry/corrections.ts';
```

- [ ] **Step 6: Full verification**

Run: `npm test && npm run typecheck && npm run validate`
Expected: all pass. `validate` should report no new findings — the register is still empty.

- [ ] **Step 7: Commit**

```bash
git add tools/src/validate/rules.ts tools/src/validate/corrections-rule.test.ts tools/src/cli/validate.ts
git commit -m "Refuse a correction whose premise or evidence does not hold"
```

---

## Task 5: The markdown report

**Files:**
- Create: `tools/src/registry/corrections-report.ts`
- Create: `tools/src/registry/corrections-report.test.ts`

**Interfaces:**
- Consumes: `Correction`, `CorrectionValue`, `evidenceSummary`, `valuesEqual` from Tasks 1-3; `RegistryEntity`.
- Produces:

```ts
export interface ReportRow {
  readonly org_id: string;
  readonly org_name: string;
  readonly entity_type: string;
  readonly field_name: string;
  readonly old_value: string;
  readonly new_value: string;
  readonly evidence: string;
  readonly checked_date: string;
  readonly status: CorrectionStatus;
}
export function formatValue(v: CorrectionValue): string;
export function reportRows(cs: readonly Correction[], registry: ReadonlyMap<string, RegistryEntity>): ReportRow[];
export function adoptedRows(cs: readonly Correction[], registry: ReadonlyMap<string, RegistryEntity>): ReportRow[];
export function buildReport(cs: readonly Correction[], registry: ReadonlyMap<string, RegistryEntity>, date: string): string;
```

- [ ] **Step 1: Write the failing test**

Create `tools/src/registry/corrections-report.test.ts`. Copy the `entity()` and `correction()` helpers verbatim from `tools/src/validate/corrections-rule.test.ts` (Task 4, Step 1) — changing the imports to `'./corrections.ts'` and `'./types.ts'` — then add:

```ts
import { describe, expect, it } from 'vitest';

import { buildReport, formatValue, reportRows } from './corrections-report.ts';

const REGISTRY = new Map([[entity().slug, entity()]]);

describe('formatValue', () => {
  it('renders a list-valued field as a readable list', () => {
    expect(formatValue(['town/a', 'town/b'])).toBe('town/a; town/b');
  });

  it('says AOE published nothing rather than printing an empty cell', () => {
    expect(formatValue(null)).toBe('(none published)');
  });
});

describe('reportRows', () => {
  it('reports what AOE currently publishes as the old value', () => {
    const [row] = reportRows([correction()], REGISTRY);
    expect(row?.org_id).toBe('SU003');
    expect(row?.org_name).toBe('Addison Central Supervisory District');
    expect(row?.field_name).toBe('website');
    expect(row?.old_value).toBe('http://old.example.invalid/');
    expect(row?.new_value).toBe('https://new.example.invalid/');
  });

  it('omits withdrawn corrections', () => {
    expect(reportRows([correction({ status: 'withdrawn' })], REGISTRY)).toEqual([]);
  });

  it('omits corrections AOE has already adopted', () => {
    const adopted = entity({ website: 'https://new.example.invalid/', aoe_published: {} });
    expect(reportRows([correction()], new Map([[adopted.slug, adopted]]))).toEqual([]);
  });
});

describe('buildReport', () => {
  it('identifies each organization the way AOE does, never by our slug', () => {
    const md = buildReport([correction()], REGISTRY, '2026-07-31');
    expect(md).toContain('SU003');
    expect(md).toContain('Addison Central Supervisory District');
    // The recipient works in AOE's systems. "su/addison-central" means nothing there.
    expect(md).not.toContain('su/addison-central');
  });

  it('carries the evidence, so the claim is checkable without replying', () => {
    const md = buildReport([correction()], REGISTRY, '2026-07-31');
    expect(md).toContain('Retrieved https://new.example.invalid/ on 2026-07-31');
  });

  it('thanks AOE for what they have already adopted', () => {
    const adopted = entity({ website: 'https://new.example.invalid/', aoe_published: {} });
    const md = buildReport([correction({ status: 'sent' })], new Map([[adopted.slug, adopted]]), '2026-07-31');
    expect(md).toContain('Adopted since the last report');
    expect(md).toContain('SU003');
  });

  it('says so plainly when there is nothing to report', () => {
    expect(buildReport([], REGISTRY, '2026-07-31')).toContain('No open corrections');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tools/src/registry/corrections-report.test.ts`
Expected: FAIL — `Cannot find module './corrections-report.ts'`.

- [ ] **Step 3: Implement it**

Create `tools/src/registry/corrections-report.ts`:

```ts
/**
 * What we send to AOE.
 *
 * One rule shapes everything here: the recipient works in AOE's systems, not
 * ours. Every row is keyed on the OrgID and organization name THEY use, and no
 * repo slug appears anywhere in the output. `su/addison-central` is an internal
 * identifier; `SU003 — Addison Central Supervisory District` is a record they
 * can open.
 *
 * The report closes by naming what AOE has already adopted. That section is not
 * politeness -- a data steward who can see their previous effort landed is a
 * data steward who reads the next message.
 */

import {
  evidenceSummary,
  upstreamState,
  valuesEqual,
  type Correction,
  type CorrectionStatus,
  type CorrectionValue,
} from './corrections.ts';
import type { RegistryEntity } from './types.ts';

export interface ReportRow {
  readonly org_id: string;
  readonly org_name: string;
  readonly entity_type: string;
  readonly field_name: string;
  readonly old_value: string;
  readonly new_value: string;
  readonly evidence: string;
  readonly checked_date: string;
  readonly status: CorrectionStatus;
}

export function formatValue(v: CorrectionValue): string {
  if (v === null) return '(none published)';
  if (Array.isArray(v)) return v.join('; ');
  return String(v);
}

function checkedDate(c: Correction): string {
  return c.evidence.class === 'derived_artifact' ? c.submitted_date : c.evidence.retrieved;
}

function rowFor(c: Correction, entity: RegistryEntity, oldValue: CorrectionValue): ReportRow {
  return {
    org_id: entity.aoe_org_id ?? '(no AOE ID)',
    org_name: entity.name,
    entity_type: entity.type,
    field_name: c.field,
    old_value: formatValue(oldValue),
    new_value: formatValue(c.our_value),
    evidence: evidenceSummary(c.evidence),
    checked_date: checkedDate(c),
    status: c.status,
  };
}

/** Corrections still to be acted on: not withdrawn, not yet adopted. */
export function reportRows(
  cs: readonly Correction[],
  registry: ReadonlyMap<string, RegistryEntity>,
): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const c of cs) {
    if (c.status === 'withdrawn') continue;
    const entity = registry.get(c.slug);
    if (!entity) continue;

    const published = entity.aoe_published?.[c.field] as CorrectionValue | undefined;
    if (published === undefined) continue; // retired, i.e. adopted
    if (upstreamState(c, published) === 'adopted') continue;

    rows.push(rowFor(c, entity, published));
  }
  return rows;
}

/**
 * Corrections AOE has taken up. Recognized by the absence of a published figure
 * on a field whose value now matches ours -- which is exactly what retirement
 * leaves behind.
 */
export function adoptedRows(
  cs: readonly Correction[],
  registry: ReadonlyMap<string, RegistryEntity>,
): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const c of cs) {
    if (c.status === 'withdrawn') continue;
    const entity = registry.get(c.slug);
    if (!entity) continue;
    if (entity.aoe_published?.[c.field] !== undefined) continue;

    const current = entity[c.field as keyof RegistryEntity] as CorrectionValue;
    if (!valuesEqual(current, c.our_value)) continue;

    rows.push(rowFor(c, entity, c.aoe_value));
  }
  return rows;
}

const TYPE_HEADING: Readonly<Record<string, string>> = {
  su: 'Supervisory unions and supervisory districts',
  sd: 'School districts',
  ud: 'Union districts',
  school: 'Public schools',
  town: 'Towns',
  academy: 'Academies',
  techcenter: 'Career and technical centers',
  independent: 'Independent schools',
  state: 'State-operated organizations',
};

export function buildReport(
  cs: readonly Correction[],
  registry: ReadonlyMap<string, RegistryEntity>,
  date: string,
): string {
  const rows = reportRows(cs, registry);
  const adopted = adoptedRows(cs, registry);

  let out =
    `# Suggested corrections to AOE organization data\n\n` +
    `Prepared ${date}.\n\n` +
    `Each item below gives the organization as your records identify it, the field, ` +
    `the value currently published, what we believe it should be, and how we checked. ` +
    `Nothing here has been changed in any AOE system — these are suggestions for your review.\n\n`;

  if (rows.length === 0) {
    out += `No open corrections.\n`;
  } else {
    const byType = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const list = byType.get(r.entity_type) ?? [];
      list.push(r);
      byType.set(r.entity_type, list);
    }

    out += `## ${rows.length} suggested correction(s)\n`;
    for (const [type, list] of [...byType].sort((a, b) => a[0].localeCompare(b[0]))) {
      out += `\n### ${TYPE_HEADING[type] ?? type}\n`;
      for (const r of list.sort((a, b) => a.org_id.localeCompare(b.org_id))) {
        out += `\n**${r.org_id} — ${r.org_name}**\n\n`;
        out += `- Field: \`${r.field_name}\`\n`;
        out += `- Currently published: ${r.old_value}\n`;
        out += `- Suggested: ${r.new_value}\n`;
        out += `- How we checked: ${r.evidence}\n`;
        out += `- Checked on: ${r.checked_date}\n`;
      }
    }
  }

  if (adopted.length > 0) {
    out += `\n## Adopted since the last report\n\n`;
    out += `These are now correct in your published data. Thank you.\n\n`;
    for (const r of adopted.sort((a, b) => a.org_id.localeCompare(b.org_id))) {
      out += `- **${r.org_id} — ${r.org_name}**, \`${r.field_name}\`: now ${r.new_value}\n`;
    }
  }

  return out;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tools/src/registry/corrections-report.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/src/registry/corrections-report.ts tools/src/registry/corrections-report.test.ts
git commit -m "Write the corrections report in AOE's identifiers, not ours"
```

---

## Task 6: The CSV export

**Files:**
- Modify: `tools/src/registry/corrections-report.ts`
- Modify: `tools/src/registry/corrections-report.test.ts`

**Interfaces:**
- Consumes: `ReportRow`, `reportRows` from Task 5.
- Produces: `export function csvField(value: string): string` and `export function buildCsv(cs: readonly Correction[], registry: ReadonlyMap<string, RegistryEntity>): string`

- [ ] **Step 1: Write the failing test**

Append to `tools/src/registry/corrections-report.test.ts`, adding `buildCsv` and `csvField` to the import:

```ts
describe('csvField', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvField('website')).toBe('website');
  });

  it('quotes a value containing a comma', () => {
    expect(csvField('Barre, Vermont')).toBe('"Barre, Vermont"');
  });

  it('doubles an embedded quote, per RFC 4180', () => {
    // Board-document titles will hit this; a naive escape corrupts the file.
    expect(csvField('The Board voted "aye"')).toBe('"The Board voted ""aye"""');
  });

  it('quotes a value containing a newline', () => {
    expect(csvField('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('buildCsv', () => {
  it('leads with AOE’s identifiers, then the three requested columns', () => {
    const csv = buildCsv([correction()], REGISTRY);
    const [header] = csv.split('\r\n');
    expect(header).toBe(
      'org_id,org_name,field_name,old_value,new_value,evidence,checked_date,status',
    );
  });

  it('writes one row per open correction, keyed on the OrgID', () => {
    const csv = buildCsv([correction()], REGISTRY);
    const rows = csv.trim().split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('SU003');
    expect(rows[1]).toContain('http://old.example.invalid/');
    expect(rows[1]).toContain('https://new.example.invalid/');
    expect(csv).not.toContain('su/addison-central');
  });

  it('emits a header and nothing else when there is nothing to report', () => {
    expect(buildCsv([], REGISTRY).trim().split('\r\n')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tools/src/registry/corrections-report.test.ts`
Expected: FAIL — `buildCsv is not a function`.

- [ ] **Step 3: Implement it**

Append to `tools/src/registry/corrections-report.ts`:

```ts
/**
 * RFC 4180 quoting. Written out rather than pulled in, because the rule is four
 * lines and a dependency for four lines is a dependency to keep updated forever.
 */
export function csvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

const CSV_COLUMNS = [
  'org_id',
  'org_name',
  'field_name',
  'old_value',
  'new_value',
  'evidence',
  'checked_date',
  'status',
] as const satisfies ReadonlyArray<keyof ReportRow>;

/**
 * The same open corrections as the markdown report, as a file someone can sort
 * and filter. `org_id` and `org_name` lead: a row that does not identify its
 * organization cannot be acted on, whatever else it carries.
 */
export function buildCsv(
  cs: readonly Correction[],
  registry: ReadonlyMap<string, RegistryEntity>,
): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of reportRows(cs, registry)) {
    lines.push(CSV_COLUMNS.map((c) => csvField(String(row[c]))).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tools/src/registry/corrections-report.test.ts && npm run typecheck`
Expected: PASS, 16 tests, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add tools/src/registry/corrections-report.ts tools/src/registry/corrections-report.test.ts
git commit -m "Export the open corrections as a CSV AOE can sort"
```

---

## Task 7: The CLI

**Files:**
- Create: `tools/src/cli/registry-corrections.ts`
- Modify: `package.json:16-34`

**Interfaces:**
- Consumes: `readCorrections` (Task 1), `buildReport` / `buildCsv` (Tasks 5-6), `readRegistry` from `tools/src/registry/store.ts`, `PATHS` / `rel` from `tools/src/paths.ts`.
- Produces: `npm run registry:corrections -- --report` and `-- --csv`.

- [ ] **Step 1: Write the CLI**

Create `tools/src/cli/registry-corrections.ts`:

```ts
#!/usr/bin/env node
/**
 * The corrections register, in the two forms it leaves the repo in.
 *
 *   npm run registry:corrections               list the open set on stdout
 *   npm run registry:corrections -- --report   write the markdown email body
 *   npm run registry:corrections -- --csv      write the CSV
 *
 * Both outputs go to derived/corrections/. They are products of a computation
 * over committed inputs, which is what derived/ is for -- but they are written
 * as .md and .csv, so the validator's derived-provenance rule (which walks
 * .yaml) correctly leaves them alone. They are correspondence, not a data
 * product other code reads.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATHS, rel } from '../paths.ts';
import { readCorrections } from '../registry/corrections.ts';
import { buildCsv, buildReport, reportRows } from '../registry/corrections-report.ts';
import { readRegistry } from '../registry/store.ts';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function main(): number {
  const argv = process.argv.slice(2);
  const wantReport = argv.includes('--report');
  const wantCsv = argv.includes('--csv');

  const registry = readRegistry();
  if (registry.size === 0) {
    console.error('The registry is empty. Run `npm run registry:sync` first.');
    return 1;
  }

  const { corrections } = readCorrections();
  const rows = reportRows(corrections, registry);
  const date = today();

  console.log(
    `${corrections.length} correction(s) in ${rel(PATHS.corrections)}; ` +
      `${rows.length} open with AOE.`,
  );
  for (const r of rows) {
    console.log(`  ${r.org_id} ${r.field_name}: ${r.old_value} -> ${r.new_value}`);
  }

  if (!wantReport && !wantCsv) return 0;

  mkdirSync(PATHS.derivedCorrections, { recursive: true });

  if (wantReport) {
    const path = join(PATHS.derivedCorrections, `report-${date}.md`);
    writeFileSync(path, buildReport(corrections, registry, date), 'utf8');
    console.log(`\nWrote ${rel(path)}`);
  }

  if (wantCsv) {
    const path = join(PATHS.derivedCorrections, `corrections-${date}.csv`);
    writeFileSync(path, buildCsv(corrections, registry), 'utf8');
    console.log(`Wrote ${rel(path)}`);
  }

  return 0;
}

process.exit(main());
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `"registry:sync"` line:

```json
    "registry:corrections": "tsx tools/src/cli/registry-corrections.ts",
```

- [ ] **Step 3: Run it against the empty register**

Run: `npm run registry:corrections`
Expected: `0 correction(s) in registry/corrections.yaml; 0 open with AOE.`

- [ ] **Step 4: Run it with both flags**

Run: `npm run registry:corrections -- --report --csv && ls derived/corrections/`
Expected: two files written. Open the markdown and confirm it reads `No open corrections.`

- [ ] **Step 5: Full verification**

Run: `npm test && npm run typecheck && npm run validate`
Expected: all pass. Confirm `validate` does not complain about the new files in `derived/` — it walks `.yaml` there, and these are `.md` and `.csv`. If it does complain, stop and report rather than special-casing the path.

- [ ] **Step 6: Commit**

```bash
git add tools/src/cli/registry-corrections.ts package.json
git commit -m "Add the registry:corrections report and CSV commands"
```

---

## Task 8: The Addison Central correction, end to end

**Files:**
- Modify: `registry/corrections.yaml`
- Modify: `registry/entities/su.json` (regenerated by the sync — do not hand-edit)
- Modify: `CONTRIBUTING.md`
- Create: `derived/corrections/report-<date>.md`, `derived/corrections/corrections-<date>.csv`

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: no new code.

> **⚠️ Evidence rule — read before writing anything.**
>
> The `observation` field must describe a retrieval that actually happened. The
> evidence below was gathered on 2026-07-31 and is quoted from real output —
> **do not paraphrase it, embellish it, or add a claim it does not support.**
>
> Step 1 re-runs the retrieval. If the result now differs from what is recorded
> here, write what you actually observed. If retrieval fails outright, do not
> invent an observation: stop and report that the evidence needs to come from a
> human who loaded the pages. `AGENT.md` already establishes that fallback for
> statute text — "fetch by hand and paste the text in" — and a hand-retrieval
> attributed to a named person is a perfectly good provenance record. A
> fabricated one is not a weaker record; it is a false one, in the field whose
> entire purpose is to be checkable.

- [ ] **Step 1: Re-run the retrieval and confirm it still matches**

Run:

```bash
curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" -L --max-time 25 https://www.acsdvt.org
curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" -L --max-time 25 http://www.acsu.k12.vt.us/
```

Observed 2026-07-31:

```
200 https://www.acsdvt.org/
curl: (7) Failed to connect to www.acsu.k12.vt.us port 80 after 3284 ms: Could not connect to server
```

The page at `acsdvt.org` titles itself **"Addison Central School District"** and
refers to itself as ACSD throughout. The `acsu.k12.vt.us` host resolves but
refuses connections on port 80 — note the distinction, `curl` exit code 7 is a
connection failure, not a name-resolution failure, and the observation must say
which one it was.

If your output matches, proceed. If it differs, use yours.

- [ ] **Step 2: Confirm what AOE currently publishes**

Run: `node -e "const r=require('./registry/entities/su.json').records.find(x=>x.slug==='su/addison-central');console.log(r.aoe_org_id, JSON.stringify(r.website))"`
Expected: `SU003 "http://www.acsu.k12.vt.us/"`

If the value differs, use what it actually prints as `aoe_value` — the correction's premise must be true.

- [ ] **Step 3: Write the correction**

Replace `corrections: []` in `registry/corrections.yaml` with:

```yaml
corrections:
  - slug: su/addison-central
    field: website
    aoe_value: "http://www.acsu.k12.vt.us/"
    aoe_value_observed: "2026-07-29"
    our_value: "https://www.acsdvt.org"
    evidence:
      class: retrieved_url
      url: "https://www.acsdvt.org"
      retrieved: "2026-07-31"
      observation: >-
        Returns HTTP 200 and titles itself "Addison Central School District",
        referring to itself as ACSD throughout. The acsu.k12.vt.us host AOE
        publishes still resolves but refuses connections on port 80 (curl exit
        code 7, connection failure rather than name-resolution failure), so the
        published URL reaches nothing.
    submitted_by: "James Nadeau"
    submitted_date: "2026-07-31"
    status: open
    sent_date: null
    note: null
```

If Step 1 produced different output, write what you observed instead. Do not
keep this text on the strength of it already being here.

- [ ] **Step 4: Apply it through the sync**

Run: `npm run registry:sync -- --from 2026-07-29`
Expected output includes `Applying 1 correction(s) from registry/corrections.yaml.`

- [ ] **Step 5: Confirm the registry now carries both figures**

Run: `node -e "const r=require('./registry/entities/su.json').records.find(x=>x.slug==='su/addison-central');console.log(JSON.stringify({website:r.website,aoe_published:r.aoe_published,overrides:r.manual_overrides},null,2))"`

Expected: `website` is `https://www.acsdvt.org`, `aoe_published.website` is `http://www.acsu.k12.vt.us/`, and one `manual_overrides` entry whose `reason` carries the evidence summary.

Also confirm the diff touched only this record: `git diff --stat registry/entities/`

- [ ] **Step 6: Validate**

Run: `npm run validate`
Expected: passes, with no `correction-` findings.

- [ ] **Step 7: Generate the report and the CSV**

Run: `npm run registry:corrections -- --report --csv`

Read both files. Confirm by eye:
- `SU003` and `Addison Central Supervisory District` appear
- the string `su/addison-central` appears in **neither**
- the CSV header is `org_id,org_name,field_name,old_value,new_value,evidence,checked_date,status`

- [ ] **Step 8: Document the workflow for contributors**

In `CONTRIBUTING.md`, add this section immediately after "Reporting an error":

```markdown
## Correcting AOE organization data

Some of what AOE publishes is out of date. A correction is not a local edit — it
is a claim against a named source, recorded in `registry/corrections.yaml` with
the value AOE published, the value it should be, and how you checked.

Evidence is tiered by what the field can break. A website needs a URL, the date
you retrieved it, and what you saw. A relationship — `operated_by`,
`supervisory_union`, `member_towns` — changes model output for every town
involved, so it needs a document and the operative sentence quoted, the same
standard `docs/parameter-verification.md` sets for a statutory parameter.

`npm run validate` enforces the tier, refuses a correction whose premise no
longer holds, and fails the build if AOE moves the field somewhere neither value
predicted.

Corrections retire themselves. Once AOE publishes the value you asserted, the
sync stops asserting it — the entity is unchanged, because the two values now
agree.

To send the open set upstream:

    npm run registry:corrections -- --report --csv

This writes a markdown email body and a CSV to `derived/corrections/`, both keyed
on AOE's own organization IDs rather than our slugs, because the person receiving
them works in AOE's systems and not this repository.
```

- [ ] **Step 9: Full verification**

Run: `npm test && npm run typecheck && npm run validate`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add registry/corrections.yaml registry/entities/su.json CONTRIBUTING.md derived/corrections/
git commit -m "Correct the Addison Central website, and say so to AOE"
```

---

## Verification of the whole feature

After Task 8, confirm each spec claim holds:

- [ ] `registry/corrections.yaml` is the only place a correction is authored; no entity file was hand-edited.
- [ ] `applyOverrides` no longer exists in `tools/src/registry/sync.ts`.
- [ ] Setting `su/addison-central`'s `website` in `registry/raw/2026-07-29/organizations.json` to `https://www.acsdvt.org`, then running `npm run registry:sync -- --from 2026-07-29`, leaves the entity's `website` unchanged and removes `aoe_published.website` and the override — adoption changes no data. **Revert the snapshot edit afterwards; it is a provenance record.**
- [ ] Setting it instead to `https://www.example.invalid/` and re-syncing keeps `https://www.acsdvt.org` in force and makes `npm run validate` fail with `correction-diverged`. **Revert afterwards.**
- [ ] `npm run registry:corrections -- --report --csv` produces files containing `SU003` and containing no repo slug.
