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

import { isMap, isSeq, parse as parseYaml, parseDocument } from 'yaml';

import { PATHS, rel } from '../paths.ts';
import { AOE_ENDPOINTS, orgId, type Snapshot } from './aoe-client.ts';
import type { ManualOverride, RegistryEntity } from './types.ts';

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
  /** The AOE address a `sent` batch went to. Null until sent. */
  readonly recipient: string | null;
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

/**
 * Whether a correction is still something AOE ought to hear about: a live claim
 * whose value they have not yet adopted. This is the single predicate both the
 * report (`reportRows`) and the mark-sent command select on, deliberately shared
 * so the set that gets emailed can never drift from the set that gets stamped
 * `sent`. A withdrawn claim, a claim about an entity the registry does not carry,
 * and a claim the sync has already retired (no `aoe_published` recorded, meaning
 * AOE now publishes our value) are all not outstanding.
 */
export function isOutstanding(
  c: Correction,
  registry: ReadonlyMap<string, RegistryEntity>,
): boolean {
  if (c.status === 'withdrawn') return false;
  const entity = registry.get(c.slug);
  if (!entity) return false;
  const published = entity.aoe_published?.[c.field] as CorrectionValue | undefined;
  if (published === undefined) return false;
  return upstreamState(c, published) !== 'adopted';
}

const CORRECTIONS_FILE_KEYS = new Set(['schema_version', 'corrections']);

/**
 * An absent register is not an error: most repos have no corrections yet.
 * A PRESENT-BUT-MALFORMED one is a different state and must not collapse into
 * the same empty result -- that collapse is exactly the failure this register
 * exists to prevent (see the module header). So this throws rather than
 * shrugging on: a document that is not an object (a bare scalar or a list),
 * unrecognized top-level keys (the `correction:`/`corrections:` typo), or a
 * `corrections` value that is present but not an array. A blank YAML document
 * (which parses to null) and an explicit `corrections: []` both stay non-errors:
 * both spell "no corrections", the one state that IS legitimately empty.
 */
export function readCorrections(path: string = PATHS.corrections): CorrectionsFile {
  if (!existsSync(path)) return { schema_version: '1.0', corrections: [] };

  const parsed: unknown = parseYaml(readFileSync(path, 'utf8'));
  if (parsed === null || parsed === undefined) return { schema_version: '1.0', corrections: [] };

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `${rel(path)}: expected an object with "schema_version" and "corrections" keys, ` +
        `got ${Array.isArray(parsed) ? 'an array' : typeof parsed}.`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  const unrecognized = Object.keys(obj).filter((k) => !CORRECTIONS_FILE_KEYS.has(k));
  if (unrecognized.length > 0) {
    throw new Error(
      `${rel(path)}: unrecognized key(s) ${unrecognized.map((k) => `"${k}"`).join(', ')}. ` +
        `Expected only "schema_version" and "corrections" -- check for a typo, ` +
        `e.g. "correction" for "corrections".`,
    );
  }

  const corrections = obj['corrections'];
  if (corrections === undefined) return { schema_version: '1.0', corrections: [] };
  if (!Array.isArray(corrections)) {
    throw new Error(`${rel(path)}: "corrections" must be an array, got ${typeof corrections}.`);
  }

  return { schema_version: '1.0', corrections: corrections as Correction[] };
}

/** What marking a correction sent records: who the batch went to and when, and an optional note. */
export interface SentStamp {
  readonly sent_date: string;
  readonly recipient: string;
  readonly note: string | null;
}

/**
 * Rewrites the corrections register, flipping the named claims from `open` to
 * `sent` and stamping each with who received the batch and when.
 *
 * It works on the file's TEXT through the YAML document API rather than
 * re-serializing a parsed object, because the register is hand-authored: its
 * header comment, and any a contributor left on a record, are part of the
 * document and must survive being written back. Only `open` claims are touched,
 * so a second run over the same set is a no-op -- the returned `marked` list is
 * exactly the keys this call changed, empty when there was nothing to do.
 *
 * `note` is written only when given: a batch sent without a note must not
 * blank out a note a record already carried.
 */
export function markSent(
  yamlText: string,
  keys: ReadonlySet<string>,
  stamp: SentStamp,
): { text: string; marked: string[] } {
  const doc = parseDocument(yamlText);
  const seq = doc.get('corrections');
  const marked: string[] = [];

  if (isSeq(seq)) {
    for (const item of seq.items) {
      if (!isMap(item)) continue;
      if (item.get('status') !== 'open') continue;
      const key = `${String(item.get('slug'))}#${String(item.get('field'))}`;
      if (!keys.has(key)) continue;

      item.set('status', 'sent');
      item.set('sent_date', stamp.sent_date);
      item.set('recipient', stamp.recipient);
      if (stamp.note !== null) item.set('note', stamp.note);
      marked.push(key);
    }
  }

  return { text: String(doc), marked };
}

/**
 * Correctable fields whose value can be read straight back out of a saved
 * snapshot, and the raw API key each one maps onto.
 *
 * This exists so a claim's PREMISE -- "AOE published X" -- can be checked
 * against the snapshot the claim itself names in `aoe_value_observed`, rather
 * than only against whatever AOE publishes today. Those are different
 * questions, and conflating them turns "this claim was never true" into "AOE
 * has moved on", which sends a human to look at the wrong thing.
 *
 * FOUR CORRECTABLE FIELDS ARE DELIBERATELY ABSENT, and their absence is a
 * decision rather than an oversight:
 *
 *   `operated_by`, `supervisory_union`, `member_towns` -- these are not raw
 *   keys. They come out of the `ParentOrg`/`OperatedBy` pair, whose meaning is
 *   INVERTED between towns and schools, and out of a second pass that inverts
 *   the town->district edges into a district's member list. sync.ts's module
 *   header exists to warn against re-implementing exactly that decoding; a
 *   second copy here that drifted would report false premises against true
 *   claims, which is worse than not checking.
 *
 *   `municipality` -- has no raw source at all. AOE never publishes a
 *   municipality (see `schoolFields` in sync.ts), so its `aoe_value` is always
 *   null and there is nothing in a snapshot to compare against.
 *
 * Their premises stay unchecked, and `correction-diverged` remains the only
 * signal for them -- which is why its message names both possibilities.
 */
export const RAW_KEY_FOR_FIELD: Readonly<Record<string, string>> = {
  website: 'Website',
  name: 'Name',
  mailing_city: 'MailingCity',
  latitude: 'Latitude',
  longitude: 'Longitude',
};

export interface PublishedLookup {
  /**
   * Whether the snapshot carries a record for this organization at all.
   * Distinct from a record that carries no value for the field: a claim about
   * an organization the snapshot never listed is a different failure from a
   * claim about a field it left empty, and the two get different messages.
   */
  readonly recordFound: boolean;
  /** What the snapshot published for the field. Null means it published none. */
  readonly value: CorrectionValue;
}

/**
 * What a saved snapshot published for one organization's field.
 *
 * Endpoints are read in `AOE_ENDPOINTS` declaration order, with later ones
 * overriding earlier ones, because that is the order and the rule
 * `normalizeSnapshot` merges by: `organizations` carries websites and mailing
 * addresses the type-specific endpoints omit, so reading any single endpoint
 * would report a website AOE does publish as absent. Only non-null values
 * override, matching the sync's `stripNulls`.
 */
export function publishedValue(
  snapshot: Snapshot,
  aoeOrgId: string,
  rawKey: string,
): PublishedLookup {
  let recordFound = false;
  let value: CorrectionValue = null;

  for (const endpoint of Object.keys(AOE_ENDPOINTS)) {
    for (const raw of snapshot.endpoints[endpoint] ?? []) {
      if (orgId(raw) !== aoeOrgId) continue;
      recordFound = true;
      const v = raw[rawKey];
      if (v === null || v === undefined) continue;
      value = typeof v === 'number' ? v : String(v);
    }
  }

  return { recordFound, value };
}

/**
 * Compares a claimed premise against what the snapshot published.
 *
 * Coordinates arrive from the API as strings (`"44.0153"`) and are stored as
 * numbers, so a `latitude` correction legitimately writes a number where the
 * raw record holds text. Comparing those as strings would fail a true claim on
 * a formatting difference. Everything else compares as-is -- and an empty
 * string is NOT read as a missing coordinate here, because
 * `valuesEqual(null, '')` is deliberately false: the two spell different
 * things and this function must not be the place that merges them.
 */
export function premiseHolds(claimed: CorrectionValue, published: CorrectionValue): boolean {
  if (typeof claimed === 'number' && typeof published === 'string') {
    const n = Number(published);
    return Number.isFinite(n) && n === claimed;
  }
  return valuesEqual(claimed, published);
}

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
 * MUST be given an entity carrying ONLY AOE's values, straight from the
 * snapshot -- never a value this function (or a prior sync) already asserted.
 * Given an already-corrected entity it would read our own assertion as AOE
 * agreement and retire the correction, which is exactly why this replaced the
 * old `applyOverrides`, whose habit of reading the previous registry state is
 * what made overrides immortal. Guaranteeing that input is the CALLER's job,
 * not this function's -- see the `municipality` handling in sync.ts's
 * `schoolFields`, which exists only because that field has no AOE value to
 * fall back on and once carried the prior registry's (i.e. our own) value
 * forward by mistake.
 */
export function applyCorrections(
  entity: RegistryEntity,
  corrections: readonly Correction[],
): RegistryEntity {
  const published: Record<string, CorrectionValue> = {};
  const overrides: ManualOverride[] = [];
  const patch: Record<string, unknown> = {};

  for (const c of corrections) {
    if (c.status === 'withdrawn') continue;

    // The whitelist is checked HERE as well as in checkCorrections, and the
    // duplication is the point. The validator's copy exists to give the
    // contributor a good message and block the merge; this one exists because
    // the sync runs BEFORE the validator and writes its output to disk. Without
    // it, a register naming `slug` or `aoe_org_id` -- fields that IDENTIFY the
    // record rather than describe it -- rewrites the identity of an entity, and
    // the sync reports and commits that registry before anything refuses it.
    // A register that never passed review must not be able to corrupt data in
    // the meantime. Skipped silently on purpose: the validator is where this
    // gets explained, and duplicating the explanation here would mean
    // maintaining the wording twice.
    if (FIELD_CLASS[c.field] === undefined) continue;

    const aoeValue = entity[c.field as keyof RegistryEntity] as CorrectionValue;
    if (upstreamState(c, aoeValue) === 'adopted') continue;

    patch[c.field] = c.our_value;
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
      patch['municipality_basis'] = c.evidence.class === 'derived_artifact'
        ? 'census_geocoder_point_in_polygon'
        : 'manual';
    }
  }

  // `aoe_published` and `manual_overrides` are stripped out and reappended at
  // the end, in that order, rather than folded into a spread-and-patch of
  // `entity`: the type and schema both declare `aoe_published` immediately
  // before `manual_overrides`, and store.ts pretty-prints one field per line
  // specifically so a sync diff stays readable, so the two fields this
  // function owns must serialize in the order a reader expects, not wherever
  // an object spread happens to leave them (a fresh key from a plain
  // `next['aoe_published'] = ...` assignment lands at the very end, after
  // `notes`). Stripping the entity's own `aoe_published` first also matters
  // on its merits: without it, a stale map from an adopted correction could
  // survive under `rest` even though `published` below is empty for it.
  const {
    manual_overrides: _manualOverrides,
    aoe_published: _aoePublished,
    notes,
    ...rest
  } = entity as unknown as Record<string, unknown> & { notes: unknown };

  const next: Record<string, unknown> = { ...rest, ...patch };
  // Only written when a correction is actually in force. An entity with none
  // (the common case -- ~900 of them today) must not carry an empty map: that
  // would put a key that says nothing on every record the sync touches, just
  // to make room for the handful this register actually corrects.
  if (Object.keys(published).length > 0) {
    next['aoe_published'] = published;
  }
  next['manual_overrides'] = overrides;
  next['notes'] = notes;
  return next as unknown as RegistryEntity;
}
