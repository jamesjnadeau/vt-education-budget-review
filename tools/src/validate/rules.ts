/**
 * Cross-file validation rules.
 *
 * Schema validation catches malformed records. These rules catch the things
 * that make a well-formed record untrustworthy, and they are what stands in
 * for an admin login: nothing reaches `main`, and therefore nothing reaches
 * the site, without passing them.
 *
 * The rules are graded. An `error` blocks the merge. A `warning` is surfaced
 * loudly and does not -- used specifically where the plan says a discrepancy is
 * itself analytically interesting and must not be silently reconciled. A
 * district's printed per-pupil figure disagreeing with our recomputation is a
 * finding to publish, not a bug to fix, so it warns.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATHS, rel } from '../paths.ts';
import type { Snapshot } from '../registry/aoe-client.ts';
import {
  EVIDENCE_FOR_CLASS,
  FIELD_CLASS,
  RAW_KEY_FOR_FIELD,
  premiseHolds,
  publishedValue,
  upstreamState,
  valuesEqual,
  type Correction,
  type CorrectionValue,
} from '../registry/corrections.ts';
import { detectPlaceholder } from '../registry/placeholder.ts';
import { ENTITY_REF, SOURCE_REF } from '../registry/slugs.ts';
import type { RegistryEntity } from '../registry/types.ts';

export type Severity = 'error' | 'warning';

export interface Finding {
  readonly severity: Severity;
  readonly file: string;
  readonly rule: string;
  readonly message: string;
}

export interface BudgetRecord {
  readonly schema_version: string;
  readonly entity: string;
  readonly fiscal_year: number;
  readonly status: string;
  readonly source: string;
  readonly not_published?: ReadonlyArray<{ path: string; [key: string]: unknown }>;
  readonly lines_flagged?: ReadonlyArray<{ path: string; [key: string]: unknown }>;
  readonly [key: string]: unknown;
}

// --------------------------------------------------------------------------
// Null accounting
// --------------------------------------------------------------------------

/**
 * Paths whose null must be explained. Descriptive and optional fields are not
 * listed -- a missing note is not a missing figure.
 */
const ACCOUNTABLE = [
  /^education_spending$/,
  /^adm\.(prekindergarten|kindergarten_through_5|grades_6_through_8|grades_9_through_12)$/,
  /^tax\.towns\.\d+\.(homestead_rate_stated|cla)$/,
];

function isAccountable(path: string): boolean {
  return ACCOUNTABLE.some((p) => p.test(path));
}

export function collectNullPaths(value: unknown, prefix = ''): string[] {
  const out: string[] = [];
  if (value === null) {
    if (prefix) out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...collectNullPaths(v, prefix ? `${prefix}.${i}` : String(i))));
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(...collectNullPaths(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

/**
 * Every unexplained null is an error.
 *
 * This is the rule that makes a null in the warehouse mean "the district did
 * not publish it" rather than "we did not look". Without it, a null
 * `education_spending` -- a figure the source may simply not have printed --
 * would be indistinguishable from one nobody checked.
 */
export function checkNullAccounting(record: BudgetRecord, file: string): Finding[] {
  const explained = new Set<string>([
    ...(record.not_published ?? []).map((n) => n.path),
    ...(record.lines_flagged ?? []).map((n) => n.path),
  ]);

  const findings: Finding[] = [];
  for (const path of collectNullPaths(record)) {
    if (!isAccountable(path)) continue;
    // tax.towns.0.cla is explained by an entry for either the exact path or
    // the whole block, since a document that publishes no town table at all
    // should not need one entry per town.
    const generalized = path.replace(/\.\d+\./, '.');
    if (explained.has(path) || explained.has(generalized)) continue;

    findings.push({
      severity: 'error',
      file,
      rule: 'null-accounting',
      message:
        `${path} is null but is not listed in not_published or lines_flagged. ` +
        `Either record that the source document does not publish it -- with who ` +
        `confirmed that and when -- or supply the value. An unexplained null cannot ` +
        `be distinguished from a field nobody checked.`,
    });
  }
  return findings;
}

// --------------------------------------------------------------------------
// Provenance
// --------------------------------------------------------------------------

interface ProvenanceArtifact {
  readonly file: string;
  readonly sha256: string;
  readonly source_url?: string | null;
  readonly retrieval_method?: string;
  readonly note?: string | null;
}

interface ProvenanceDoc {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly artifacts: readonly ProvenanceArtifact[];
}

export function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Checks that a warehouse record's source artifact exists, is registered in a
 * provenance file, and has not been altered since it was retrieved.
 *
 * Raw intake is sacred: artifacts are stored exactly as released and never
 * edited. A hash mismatch is therefore always an error, never a prompt to
 * update the hash.
 */
export function checkProvenance(
  record: BudgetRecord,
  file: string,
  options: { readonly verifyHashes: boolean },
): Finding[] {
  const findings: Finding[] = [];
  const sourcePath = join(PATHS.intake, '..', record.source);

  if (!existsSync(sourcePath)) {
    findings.push({
      severity: 'error',
      file,
      rule: 'source-exists',
      message: `source "${record.source}" does not exist in the repository.`,
    });
    return findings;
  }

  const dir = sourcePath.slice(0, sourcePath.lastIndexOf('/'));
  const provenancePath = join(dir, 'provenance.yaml');
  if (!existsSync(provenancePath)) {
    findings.push({
      severity: 'error',
      file,
      rule: 'provenance-exists',
      message: `no provenance.yaml beside ${record.source}. Every raw artifact carries one.`,
    });
    return findings;
  }

  return findings;
}

export function checkProvenanceDoc(
  doc: ProvenanceDoc,
  file: string,
  dir: string,
  options: {
    readonly verifyHashes: boolean;
    /**
     * Absolute paths of artifacts that MUST be materialised this run -- the
     * ones that changed against the base ref, which CI fetches selectively
     * instead of pulling the whole LFS corpus. An artifact in this set that is
     * still a pointer means the selective fetch silently failed, and a run that
     * verifies nothing while reporting success is worse than the bandwidth bill
     * the selective fetch exists to avoid. So for these it is an error, not the
     * warning an unchanged, deliberately-unfetched pointer earns.
     */
    readonly requireFetched?: ReadonlySet<string>;
  },
): Finding[] {
  const findings: Finding[] = [];
  const requireFetched = options.requireFetched ?? new Set<string>();

  for (const artifact of doc.artifacts) {
    const path = join(dir, artifact.file);
    if (!existsSync(path)) {
      findings.push({
        severity: 'error',
        file,
        rule: 'artifact-exists',
        message: `artifact "${artifact.file}" is listed in provenance but is not present.`,
      });
      continue;
    }

    if (options.verifyHashes) {
      const isLfsPointer = readFileSync(path, 'utf8').startsWith('version https://git-lfs');
      if (isLfsPointer) {
        const mustBeFetched = requireFetched.has(path);
        findings.push({
          severity: mustBeFetched ? 'error' : 'warning',
          file,
          rule: mustBeFetched ? 'hash-verification-unfetched' : 'hash-verification',
          message: mustBeFetched
            ? `"${artifact.file}" changed in this run but is still an unfetched Git LFS pointer, ` +
              `so its hash was not verified. The selective \`git lfs pull\` did not materialise ` +
              `it. Failing rather than passing: a changed artifact whose bytes were never seen ` +
              `has been verified by nothing.`
            : `"${artifact.file}" is an unfetched Git LFS pointer, so its hash could not be ` +
              `verified. Run \`git lfs pull\` before treating this check as having passed.`,
        });
        continue;
      }
      const actual = sha256Of(path);
      if (actual !== artifact.sha256) {
        findings.push({
          severity: 'error',
          file,
          rule: 'hash-verification',
          message:
            `"${artifact.file}" hashes to ${actual} but provenance records ${artifact.sha256}. ` +
            `Raw artifacts are never edited -- do not update the hash to match. Work out what ` +
            `changed the file.`,
        });
      }
    }

    if (!artifact.source_url) {
      const method = artifact.retrieval_method ?? '';
      if (method !== 'email' && method !== 'in_person' && method !== 'foia') {
        findings.push({
          severity: 'error',
          file,
          rule: 'provenance-completeness',
          message: `"${artifact.file}" has no source_url and retrieval_method is "${method}", which requires one.`,
        });
      } else if (!artifact.note) {
        findings.push({
          severity: 'error',
          file,
          rule: 'provenance-completeness',
          message: `"${artifact.file}" was obtained by ${method} and has no source_url, so it needs a note explaining where it came from.`,
        });
      }
    }
  }

  return findings;
}

/**
 * A derived provenance record has to be usable, not merely present.
 *
 * The whole point of the `derived` kind is that someone who disputes an output
 * can reproduce it. That is only true if every input is pinned to something
 * immutable. An input recorded with `pinned_by: sha256` and a null `pin` looks
 * like provenance, satisfies the schema, and answers nothing -- which is the
 * failure worth catching, because it is the one that happens by accident when a
 * run writes its own record.
 */
export function checkDerivedProvenance(data: unknown, file: string): Finding[] {
  const doc = data as { kind?: string; derivation?: { inputs?: Array<{ ref?: string; pinned_by?: string; pin?: string | null }> } };
  if (doc.kind !== 'derived') return [];

  const findings: Finding[] = [];
  for (const input of doc.derivation?.inputs ?? []) {
    if (input.pinned_by === 'git_sha' && !input.pin) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'derived-input-unpinned',
        message:
          `input "${input.ref}" says it is pinned by git sha but records none. Commit the ` +
          `derived output in the same commit as the input it was built from, then fill the sha ` +
          `in -- a pin nobody can use is not a pin.`,
      });
    }
    if (input.pinned_by === 'sha256' && !/^[a-f0-9]{64}$/.test(input.pin ?? '')) {
      findings.push({
        severity: 'error',
        file,
        rule: 'derived-input-unpinned',
        message:
          `input "${input.ref}" claims a sha256 pin but does not carry one. The output cannot ` +
          `be reproduced from an input nobody can identify.`,
      });
    }
  }
  return findings;
}

/**
 * The land-versus-total-area rule, enforced on the data rather than trusted to
 * the importer.
 *
 * Vermont has towns whose water area is a third of their extent. Dividing a
 * population by total area understates density and pulls exactly those towns
 * into sparse eligibility. The census record carries both figures on purpose --
 * so the distinction is visible -- which also makes it possible for a later edit
 * to quietly put the wrong one in the land field.
 */
export function checkLandAreaOnly(data: unknown, file: string): Finding[] {
  const doc = data as {
    area_measure?: string;
    towns?: Array<{ entity?: string | null; land_area_sq_mi?: number | null; water_area_sq_mi?: number | null }>;
  };

  const findings: Finding[] = [];
  if (doc.area_measure !== 'aland') {
    findings.push({
      severity: 'error',
      file,
      rule: 'land-area-only',
      message:
        `area_measure is "${doc.area_measure}", not "aland". The sparse screen divides by square ` +
        `miles of LAND. If the statutory phrase turns out not to say "of land", change this in ` +
        `the same commit as the reading and expect the golden fixture to fail.`,
    });
  }

  for (const town of doc.towns ?? []) {
    const land = town.land_area_sq_mi;
    const water = town.water_area_sq_mi;
    if (typeof land !== 'number' || typeof water !== 'number') continue;
    if (land === 0 && water > 0) {
      findings.push({
        severity: 'error',
        file,
        rule: 'land-area-only',
        message:
          `${town.entity ?? 'a subdivision'} has zero land area and ${water} square miles of ` +
          `water. Dividing by that gives an infinite density, and the more likely explanation ` +
          `is that the two columns have been swapped.`,
      });
    }
  }
  return findings;
}

// --------------------------------------------------------------------------
// Registry references
// --------------------------------------------------------------------------

/**
 * Every slug mentioned anywhere must resolve to a registry entity.
 *
 * `ENTITY_REF` and `SOURCE_REF` are imported, not written out here. This module
 * used to carry its own copy of the pattern, deliberately omitting `source` so
 * that a publisher slug fell through unmatched -- which made the `SOURCE_REF`
 * early return below belt-and-braces. Now that there is one pattern and it
 * includes `source` (as the schema's has all along), that early return is
 * LOAD-BEARING: it is the single place the publisher exemption is granted, and
 * it is granted explicitly rather than encoded as an omission from a copied
 * pattern that nobody would notice going missing. AOE publishes statewide
 * datasets but has no organization record of its own -- the only `state/` entity
 * is Woodside, closed 2020 -- so requiring a `source/` slug to resolve to a
 * registry entity is precisely what it exists to avoid.
 */
export function checkRegistryRefs(
  value: unknown,
  file: string,
  registry: ReadonlyMap<string, RegistryEntity>,
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (SOURCE_REF.test(v)) return;
      if (ENTITY_REF.test(v) && !seen.has(v)) {
        seen.add(v);
        if (!registry.has(v)) {
          findings.push({
            severity: 'error',
            file,
            rule: 'registry-reference',
            message: `"${v}" is not a known registry entity. Run \`npm run registry:sync\` or correct the slug.`,
          });
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };

  walk(value);
  return findings;
}

// --------------------------------------------------------------------------
// Placeholder records
// --------------------------------------------------------------------------

/**
 * Catches placeholder records that reached the registry.
 *
 * The sync already filters these, so in normal operation this finds nothing.
 * It exists because the sync is not the only way a record can arrive: a
 * hand-edit, a bad merge, or a manual override can all put one in, and a
 * registry entry named "Test" published on a public page is precisely the
 * detail that invites a reader to doubt everything else on the site. Two
 * independent checks on different code paths is the right amount for something
 * that costs nothing to run.
 */
export function checkPlaceholderEntities(
  data: unknown,
  file: string,
): Finding[] {
  const records = (data as { records?: unknown }).records;
  if (!Array.isArray(records)) return [];

  const findings: Finding[] = [];
  for (const record of records as Array<{ slug?: string; name?: string; aoe_org_id?: string }>) {
    const verdict = detectPlaceholder({
      id: record.aoe_org_id ?? null,
      name: record.name ?? null,
    });
    if (verdict.isPlaceholder) {
      findings.push({
        severity: 'error',
        file,
        rule: 'placeholder-entity',
        message:
          `"${record.slug ?? record.name ?? 'unknown'}" looks like a placeholder or test ` +
          `record — ${verdict.reason}. The registry sync filters these, so this one arrived ` +
          `another way. Remove it, or if it is a real organization adjust detectPlaceholder ` +
          `in tools/src/registry/placeholder.ts.`,
      });
    }
  }
  return findings;
}

// --------------------------------------------------------------------------
// The corrections register
// --------------------------------------------------------------------------

/**
 * Reads a saved snapshot directory, or returns null when there is no directory
 * of that date.
 *
 * Null is "no such snapshot", never "a snapshot with nothing in it" -- a claim
 * citing a provenance record that does not exist is a worse failure than one
 * whose record disagrees with it, and the two get different findings. Injected
 * rather than read here so a test can hand this rule a snapshot without writing
 * one to registry/raw/.
 */
export type SnapshotReader = (date: string) => Snapshot | null;

/** Renders a value for a message without pretending null is an empty string. */
function shown(v: CorrectionValue): string {
  return v === null ? '(nothing)' : JSON.stringify(v);
}

/**
 * Checks a claim's premise against the snapshot it names.
 *
 * Returns no finding at all -- rather than a passing verdict -- for the fields
 * `RAW_KEY_FOR_FIELD` deliberately omits. See that table for which four and
 * why: their premises are not checkable without re-implementing the type-
 * dependent ParentOrg/OperatedBy decoding sync.ts's header warns against, and
 * `municipality` has no raw source at all.
 */
function premiseFindings(
  c: Correction,
  entity: RegistryEntity,
  file: string,
  readSnapshotFor: SnapshotReader,
): Finding[] {
  const rawKey = RAW_KEY_FOR_FIELD[c.field];
  if (!rawKey) return [];

  const key = `${c.slug}#${c.field}`;

  // Schema-invalid records are skipped without a second finding, the same way
  // the caller skips a missing slug or evidence: the schema names the missing
  // field precisely and this rule would only say it worse.
  if (typeof c.aoe_value_observed !== 'string') return [];

  if (!entity.aoe_org_id) {
    // Every entity the sync writes carries the org ID it was keyed on, so this
    // is a hand-edited or placeholder record. There is no key to look the raw
    // record up by, and saying so is better than silently passing a claim
    // whose premise was never examined.
    return [
      {
        severity: 'error',
        file,
        rule: 'correction-premise-uncheckable',
        message:
          `${key}: "${c.slug}" carries no AOE organization ID, so the snapshot record this ` +
          `claim rests on cannot be located. Re-run \`npm run registry:sync\`, or drop the claim.`,
      },
    ];
  }

  const snapshot = readSnapshotFor(c.aoe_value_observed);
  if (!snapshot) {
    return [
      {
        severity: 'error',
        file,
        rule: 'correction-snapshot-missing',
        message:
          `${key}: aoe_value_observed names ${c.aoe_value_observed}, but there is no snapshot ` +
          `at registry/raw/${c.aoe_value_observed}/. The claim cites a provenance record that ` +
          `is not in the repository, so nothing can confirm AOE ever published ` +
          `${shown(c.aoe_value)}. Name a snapshot that exists (\`ls registry/raw\`).`,
      },
    ];
  }

  const { recordFound, value } = publishedValue(snapshot, entity.aoe_org_id, rawKey);
  if (!recordFound) {
    return [
      {
        severity: 'error',
        file,
        rule: 'correction-false-premise',
        message:
          `${key}: the ${c.aoe_value_observed} snapshot has no record for ${entity.aoe_org_id}, ` +
          `so it cannot be the source of the claim that AOE published ${shown(c.aoe_value)}. ` +
          `Check the org ID and the snapshot date.`,
      },
    ];
  }

  if (!premiseHolds(c.aoe_value, value)) {
    return [
      {
        severity: 'error',
        file,
        rule: 'correction-false-premise',
        message:
          `${key}: this claims AOE published ${shown(c.aoe_value)}, but the ` +
          `${c.aoe_value_observed} snapshot publishes ${shown(value)} for ${entity.aoe_org_id}. ` +
          `A correction is a claim about a named source; one whose premise the source never ` +
          `supported is not a correction. Fix aoe_value, or name the snapshot you actually read.`,
      },
    ];
  }

  return [];
}

/**
 * Keeps the register honest about the source it makes claims against.
 *
 * Two checks earn their keep, and they ask different questions.
 *
 * `correction-false-premise` asks whether the claim was EVER true: every
 * correction asserts "AOE published X", names the snapshot it read X from, and
 * that snapshot is committed under registry/raw/, so the assertion is directly
 * checkable. A claim whose premise never held is incoherent and must not
 * validate.
 *
 * `correction-diverged` asks whether it is STILL true. When AOE moves a
 * corrected field to some THIRD value -- a genuine new website, a merger -- the
 * sync deliberately holds our value rather than silently deferring, because
 * discarding an evidence-backed assertion without telling anyone is how the old
 * override mechanism went wrong. Holding it is only safe if the build then
 * stops, so this errors and a human resolves it.
 *
 * Before the premise check existed, `correction-diverged` was the only signal
 * for both, and it asserted the second explanation for a symptom that had two.
 */
export function checkCorrections(
  corrections: readonly Correction[],
  file: string,
  registry: ReadonlyMap<string, RegistryEntity>,
  readSnapshotFor: SnapshotReader,
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const c of corrections) {
    // Schema validation and this rule run over the SAME data, and findings
    // are collected rather than fatal, by design -- so this cannot assume the
    // schema passed. A correction missing a required field already has a
    // precise schema:corrections finding pointing at what's absent; reading
    // it as a claim anyway ranges from misleading (an undefined slug would
    // read below as "unknown entity", which is not what's actually wrong) to
    // an outright crash (undefined.class on a missing `evidence`). Skip it
    // here WITHOUT another finding: the schema already reported this
    // precisely, and two findings for one missing field is noise.
    if (
      typeof c.slug !== 'string' ||
      typeof c.field !== 'string' ||
      typeof c.status !== 'string' ||
      typeof c.evidence?.class !== 'string'
    ) {
      continue;
    }

    if (c.status === 'withdrawn') continue;

    // A `sent` claim is a claim with a receipt: it must name who it went to and
    // when, or its audit trail cannot be reconstructed later. This is the gate
    // that makes `npm run registry:corrections -- --sent` the sane path to the
    // sent state -- a hand-edit that flips `status` to sent without the two
    // stamps is caught here rather than leaving a silent hole in the record.
    if (c.status === 'sent') {
      const missing: string[] = [];
      if (c.sent_date == null) missing.push('sent_date');
      if (c.recipient == null) missing.push('recipient');
      if (missing.length > 0) {
        findings.push({
          severity: 'error',
          file,
          rule: 'correction-sent-incomplete',
          message:
            `${c.slug}#${c.field} is marked sent but records no ${missing.join(' or ')}. ` +
            `A sent correction names who received it and when, or the audit trail is a ` +
            `claim without a receipt. Mark corrections sent with ` +
            `\`npm run registry:corrections -- --sent\` rather than editing status by hand.`,
        });
      }
    }

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

    // FIELD_CLASS is deliberately type-agnostic: it is the whitelist of what
    // CAN be corrected across every entity type, not what a given type
    // carries. Without this check, a correction naming a school-only field
    // (`municipality`) against a `town` entity would read `entity[c.field]`
    // as `undefined`, and `JSON.stringify` drops `undefined` values, so the
    // sync would silently reproduce the empty `aoe_published: {}` this
    // register goes out of its way to avoid. `in` -- not a null or truthiness
    // check -- is what tells "this type has no such field" apart from "this
    // field is null", which here is a real, legitimate value.
    if (!(c.field in entity)) {
      findings.push({
        severity: 'error',
        file,
        rule: 'correction-field-not-on-entity',
        message:
          `${key}: "${entity.type}" records do not carry a "${c.field}" field. Check the ` +
          `entity's type, or that the field name in this correction is correct.`,
      });
      continue;
    }

    const premise = premiseFindings(c, entity, file, readSnapshotFor);
    if (premise.length > 0) {
      findings.push(...premise);
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
          `${key}: AOE publishes a value matching neither the one this correction objected ` +
          `to nor the one it asserts. ` +
          // Divergence has two possible causes and the message must not assert
          // the one it cannot distinguish. Where the premise IS checkable it
          // has already been checked above -- this finding is unreachable
          // until it passes -- so only one cause remains and the message says
          // so. Where it is not, both stay open and the message names both.
          (RAW_KEY_FOR_FIELD[c.field]
            ? `The premise checks out against registry/raw/${c.aoe_value_observed}/, so AOE ` +
              `has moved on since then. `
            : `Either AOE has moved on since ${c.aoe_value_observed}, or the claim's premise ` +
              `was never true -- this field's premise cannot be read back out of a snapshot ` +
              `(see RAW_KEY_FOR_FIELD), so neither has been ruled out. `) +
          `The corrected value is still in force, deliberately: an evidence-backed assertion ` +
          `is not dropped silently. Re-check the field, then either update aoe_value and the ` +
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

export function summarize(findings: readonly Finding[]): { errors: number; warnings: number } {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
  };
}

export function formatFinding(finding: Finding): string {
  const mark = finding.severity === 'error' ? 'ERROR' : 'warn ';
  return `  ${mark} ${rel(finding.file)} [${finding.rule}]\n        ${finding.message}`;
}
