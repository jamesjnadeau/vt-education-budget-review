/**
 * What we send to AOE.
 *
 * One rule shapes everything here: the recipient works in AOE's systems, not
 * ours. Every row is keyed on the OrgID and organization name THEY use, and no
 * repo slug appears anywhere in the output. `su/addison-central` is an internal
 * identifier; `SU003 — Addison Central Supervisory District` is a record they
 * can open. That includes VALUES, not just the row's subject: `operated_by`,
 * `supervisory_union`, `member_towns`, and `municipality` are themselves
 * registry references, so a corrected `member_towns` list is exactly as much
 * a leak as an unresolved subject would be if it printed `town/calais`
 * instead of `T042 — Calais`. It includes EVIDENCE LOCATORS, which are file
 * paths into this repository and reach the same reader by a different route
 * (see `reportEvidence`). And it includes the organization's own name, which
 * for a `name` correction is not the name AOE holds (see `aoeName`).
 *
 * The report closes by naming what AOE has already adopted. That section is not
 * politeness -- a data steward who can see their previous effort landed is a
 * data steward who reads the next message.
 */

import {
  isOutstanding,
  valuesEqual,
  type Correction,
  type CorrectionStatus,
  type CorrectionValue,
  type Evidence,
} from './corrections.ts';
import { ENTITY_REF, SOURCE_REF } from './slugs.ts';
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

/**
 * A correction value that merely looks like a slug (a URL, a name) is printed
 * as-is. One that IS a slug -- `operated_by`, `member_towns`, and the like are
 * registry references, not descriptive text -- must resolve to the
 * organization AOE's system knows, or the report leaks exactly the kind of
 * internal identifier the module header says never appears here.
 *
 * `ENTITY_REF` is imported from `slugs.ts`, where the entity-type prefixes are
 * defined. It used to be a hand-copy, which is a poor way to build a leak
 * guard: adding a prefix to `slugs.ts` and forgetting the copy here would let a
 * corrected `operated_by` print a raw repo slug into an email to AOE, and no
 * test would fail.
 */
function formatScalar(v: string | number, registry: ReadonlyMap<string, RegistryEntity>): string {
  if (typeof v === 'number' || !ENTITY_REF.test(v)) return String(v);

  // The `source/` prefix is excluded from resolution HERE, explicitly, rather
  // than by importing a pattern that quietly omits it. A source slug names a
  // data publisher, not an organization -- there is deliberately no registry
  // record to find -- so looking one up would report it as a missing
  // organization, which is a wrong answer rather than merely an unhelpful one.
  // It is still not printed: this function's contract is that no repo-internal
  // identifier gets past it, and a publisher slug is one. Unreachable today
  // (no entity-ref-valued correctable field can hold a source ref) and kept
  // because the next correctable field is not required to respect that.
  if (SOURCE_REF.test(v)) return '(a data source, not an organization)';

  const referenced = registry.get(v);
  // Already an error the validator catches (correction-unknown-entity,
  // registry-reference); the report's job is to say so plainly, not to make
  // the dangling reference worse by printing our internal slug for it.
  if (!referenced) return '(organization not in the registry)';
  // aoeName, not `.name`: a referenced organization can be under a name
  // correction of its own, and naming it by OUR proposed name has the same
  // problem as heading a row with it -- see aoeName below.
  return `${referenced.aoe_org_id ?? '(no AOE ID)'} — ${aoeName(referenced)}`;
}

export function formatValue(v: CorrectionValue, registry: ReadonlyMap<string, RegistryEntity>): string {
  if (v === null) return '(none published)';
  if (Array.isArray(v)) return v.map((x) => formatScalar(x, registry)).join('; ');
  // Array.isArray narrows the true branch to `readonly string[]` but, being a
  // guard written for mutable arrays, does not narrow it OUT of this branch --
  // `v` is still typed `string | number | readonly string[]` here even though
  // the array case is already handled above.
  return formatScalar(v as string | number, registry);
}

function checkedDate(c: Correction): string {
  return c.evidence.class === 'derived_artifact' ? c.submitted_date : c.evidence.retrieved;
}

/**
 * The evidence, as the recipient can act on it.
 *
 * Deliberately NOT `evidenceSummary`, which is the provenance rendering: it
 * names the locator -- `intake/acsd/2026-05-minutes.pdf`, or a `derived/` path
 * and the provenance hash of the record relied on -- and that is exactly right
 * for `corrections.yaml` and for the generated `manual_overrides` reason, where
 * the whole point is that a reader here can find the record. It is exactly
 * wrong in an email to AOE, where a path into this repository identifies
 * nothing the recipient can open and, per the module header, is precisely what
 * must never leave. The register still stores the locator; this is a rendering
 * concern and is solved by rendering.
 *
 * What survives is what makes the claim checkable BY THEM: a public URL where
 * there is one, the document's title and the operative quote where there is
 * not, and an offer to send the record.
 */
export function reportEvidence(e: Evidence): string {
  switch (e.class) {
    case 'retrieved_url':
      // A URL is public by construction: the recipient can open it themselves,
      // which is why contact fields need nothing more than this.
      return `Retrieved ${e.url} on ${e.retrieved}: ${e.observation}`;
    case 'cited_document':
      return e.document_url
        ? `${e.document} (${e.document_url}), retrieved ${e.retrieved}: "${e.quote}"`
        : `${e.document}, obtained ${e.retrieved}: "${e.quote}" (we hold a copy of this ` +
          `record and can send it on request)`;
    case 'derived_artifact':
      // Described rather than located. The path and provenance hash identify a
      // file in this repository and mean nothing to the recipient; the
      // observation is the finding itself, which is what they can act on.
      return (
        `Computed by us from published sources rather than read off a document: ${e.observation} ` +
        `(the computation and its inputs are recorded in our provenance log, available on request)`
      );
  }
}

/**
 * How AOE's own records name this organization.
 *
 * A `name` correction is the case that breaks the obvious answer: by the time
 * the report runs, the sync has already patched `entity.name` to the name WE
 * propose, so heading the item with it would identify the organization to the
 * recipient by a name their system has never held -- above a body reading
 * "Currently published: <the name they do hold>". `aoe_published.name` is
 * exactly the figure their system carries, which is the whole reason the sync
 * records it. Its absence means no name correction is in force, and then
 * `entity.name` IS AOE's name.
 */
function aoeName(entity: RegistryEntity): string {
  const published = entity.aoe_published?.['name'];
  return typeof published === 'string' ? published : entity.name;
}

function rowFor(
  c: Correction,
  entity: RegistryEntity,
  oldValue: CorrectionValue,
  registry: ReadonlyMap<string, RegistryEntity>,
): ReportRow {
  return {
    org_id: entity.aoe_org_id ?? '(no AOE ID)',
    org_name: aoeName(entity),
    entity_type: entity.type,
    field_name: c.field,
    old_value: formatValue(oldValue, registry),
    new_value: formatValue(c.our_value, registry),
    evidence: reportEvidence(c.evidence),
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
    // The one predicate the report and the mark-sent command share, so the set
    // that leaves in an email is exactly the set that gets stamped `sent`.
    if (!isOutstanding(c, registry)) continue;
    const entity = registry.get(c.slug) as RegistryEntity;
    const published = entity.aoe_published?.[c.field] as CorrectionValue;
    rows.push(rowFor(c, entity, published, registry));
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

    rows.push(rowFor(c, entity, c.aoe_value, registry));
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
