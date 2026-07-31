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
 * instead of `T042 — Calais`.
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

/**
 * Mirrors `$defs.entity_ref` in `schemas/common-1.0.schema.json` (itself
 * already mirrored once, as `ENTITY_REF` in `tools/src/validate/rules.ts`).
 * `source/` is left out on purpose: none of the four entity-ref-valued
 * correctable fields (`operated_by`, `supervisory_union`, `member_towns`,
 * `municipality`) can hold one -- that prefix names a data publisher, not an
 * organization the registry carries a record for. If the schema pattern ever
 * changes, all copies must change together.
 */
const ENTITY_REF = /^(su|sd|ud|school|town|academy|techcenter|independent|state)\/[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A correction value that merely looks like a slug (a URL, a name) is printed
 * as-is. One that IS a slug -- `operated_by`, `member_towns`, and the like are
 * registry references, not descriptive text -- must resolve to the
 * organization AOE's system knows, or the report leaks exactly the kind of
 * internal identifier the module header says never appears here.
 */
function formatScalar(v: string | number, registry: ReadonlyMap<string, RegistryEntity>): string {
  if (typeof v === 'number' || !ENTITY_REF.test(v)) return String(v);
  const referenced = registry.get(v);
  // Already an error the validator catches (correction-unknown-entity,
  // registry-reference); the report's job is to say so plainly, not to make
  // the dangling reference worse by printing our internal slug for it.
  if (!referenced) return '(organization not in the registry)';
  return `${referenced.aoe_org_id ?? '(no AOE ID)'} — ${referenced.name}`;
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

function rowFor(
  c: Correction,
  entity: RegistryEntity,
  oldValue: CorrectionValue,
  registry: ReadonlyMap<string, RegistryEntity>,
): ReportRow {
  return {
    org_id: entity.aoe_org_id ?? '(no AOE ID)',
    org_name: entity.name,
    entity_type: entity.type,
    field_name: c.field,
    old_value: formatValue(oldValue, registry),
    new_value: formatValue(c.our_value, registry),
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
