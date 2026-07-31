/**
 * Builds the registry from an AOE API snapshot.
 *
 * The single most important thing this module does is untangle the API's
 * relationship fields, whose meaning is INVERTED between towns and schools:
 *
 *   town    T011  ParentOrg = U097 (its union district)   OperatedBy = SU061 (its SU)
 *   school  PS001 ParentOrg = SU048 (its SU)              OperatedBy = U096 (its district)
 *
 * Reading `ParentOrg` uniformly as "the parent" would silently file every town
 * under a district and every school under a supervisory union, producing a
 * registry that looks plausible and is wrong about who operates what. Since the
 * whole modeling tool keys off which districts serve which towns, that error
 * would propagate into every scenario. Nothing downstream reads the raw fields.
 *
 * The API publishes no opening dates and no successor relationships, so
 * `effective_from` for anything first seen through the sync is the snapshot date
 * that first observed it, marked `first_observed` -- not to be read as a
 * founding date. Closure dates do come from the API's `CloseDate`, and are
 * marked `aoe_published`. Successors are hand-entered.
 */

import { gradeSpanClassOf, normalizeGradeSpan } from '@vt-budget/model';

import { orgId, type AoeRawRecord, type Snapshot } from './aoe-client.ts';
import { applyCorrections, correctionsBySlug, type Correction } from './corrections.ts';
import { detectPlaceholder, isReportingBucket } from './placeholder.ts';
import { assignSlug, entityTypeFromOrgType, untrackedReason } from './slugs.ts';
import type { EntityType, RegistryEntity } from './types.ts';

export interface NormalizeOptions {
  /** Existing registry, keyed by slug, so slugs and hand-set fields like `notes` survive. */
  readonly existing: ReadonlyMap<string, RegistryEntity>;
  /** Snapshot date, used as first_observed for entities new to the registry. */
  readonly today: string;
  /** The corrections register. Applied last, over AOE's values. */
  readonly corrections?: readonly Correction[];
}

interface Relationship {
  readonly supervisory_union: string | null;
  readonly operated_by: string | null;
}

/**
 * Resolves the API's ParentOrg/OperatedBy pair into unambiguous roles.
 * See the module header -- the mapping is genuinely type-dependent.
 */
export function relationshipsFor(type: EntityType, raw: AoeRawRecord): Relationship {
  switch (type) {
    case 'town':
      // For a town, OperatedBy names the SU and ParentOrg names the union
      // district whose territory the town sits in.
      return { supervisory_union: raw.OperatedBy ?? null, operated_by: raw.ParentOrg ?? null };
    case 'school':
    case 'academy':
    case 'techcenter':
    case 'independent':
    case 'state':
      // For a school it is the other way round.
      return { supervisory_union: raw.ParentOrg ?? null, operated_by: raw.OperatedBy ?? null };
    case 'ud':
    case 'sd':
      return { supervisory_union: raw.ParentOrg ?? null, operated_by: null };
    case 'su':
      // An SU's OperatedBy points at itself; recording that would be noise.
      return { supervisory_union: null, operated_by: null };
  }
}

const SCHOOL_TYPES: Partial<Record<EntityType, RegistryEntity['school_type']>> = {
  school: 'public',
  academy: 'approved_independent',
  independent: 'approved_independent',
  techcenter: 'career_technical_center',
};

/**
 * The fields the small/sparse layer needs on a school, and nothing else.
 *
 * Two of them are deliberately NOT derived here even though the data looks
 * available:
 *
 *   `municipality` -- the API publishes a mailing address, and a postal city is
 *   not a municipality. Vermont post office names routinely cover parts of
 *   several towns, so wiring MailingCity into the field the sparse screen reads
 *   would put a plausible wrong town behind a statutory test. The mailing city
 *   is recorded under its own name; the municipality arrives from the point-in-
 *   polygon geocode in `derived/school-municipality/`, or from a human -- in
 *   both cases through a `municipality` correction in the register, which is
 *   the ONLY route into this field (`writeRegistry` is never called from the
 *   geocode tool). It MUST start here as AOE's actual value, which is null:
 *   AOE never publishes a municipality at all. Carrying `prior.municipality`
 *   forward, the way `geocode_precision` below does, would hand `applyCorrections`
 *   an entity that already carries OUR asserted value from the last sync --
 *   which reads as AOE having agreed with us, and retires a correction AOE
 *   never touched. `applyCorrections` is only correct on an entity carrying
 *   AOE's values; guaranteeing that is this function's job, not its caller's.
 *   A correction still in force re-derives the value every sync regardless.
 *
 *   `geocode_precision` -- AOE states none, so the sync says `unknown` rather
 *   than assuming rooftop. The distance criterion declines at that precision.
 *   Unlike `municipality` this field is not in `FIELD_CLASS` (not correctable),
 *   so there is no register to re-derive it and carrying it forward from prior
 *   is the only way a hand-set value would ever survive a sync.
 */
function schoolFields(
  type: EntityType,
  raw: AoeRawRecord,
  prior: RegistryEntity | undefined,
): Partial<RegistryEntity> {
  const schoolType = SCHOOL_TYPES[type];
  if (!schoolType) return {};

  const span = normalizeGradeSpan(raw.Grades ?? []);

  return {
    grade_span: span,
    grade_span_class: gradeSpanClassOf(span),
    mailing_city: raw.MailingCity ?? null,
    municipality: null,
    municipality_basis: 'unknown',
    // Preserved across syncs: whatever established this did not come from the
    // API, so the API must not be able to erase it. Safe only because this
    // field carries no correction of its own -- see the comment above.
    geocode_precision: prior?.geocode_precision ?? 'unknown',
    school_type: schoolType,
  };
}

function parseCoordinate(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function closeDateOf(raw: AoeRawRecord): string | null {
  if (!raw.CloseDate) return null;
  const t = Date.parse(raw.CloseDate);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export interface NormalizeResult {
  readonly entities: readonly RegistryEntity[];
  /** Things that need a human's attention. */
  readonly warnings: readonly string[];
  /** Entities deliberately not tracked, with the reason. Not problems. */
  readonly notTracked: readonly string[];
}

export function normalizeSnapshot(snapshot: Snapshot, options: NormalizeOptions): NormalizeResult {
  const warnings: string[] = [];
  const notTracked: string[] = [];

  const existingByOrgId = new Map<string, string>();
  const existingBySlug = new Map<string, RegistryEntity>(options.existing);
  for (const entity of options.existing.values()) {
    if (entity.aoe_org_id) existingByOrgId.set(entity.aoe_org_id, entity.slug);
  }
  const taken = new Set<string>(existingBySlug.keys());

  // Merge every endpoint into one pass, keyed by org ID. Later endpoints
  // enrich earlier ones rather than replacing them -- `organizations` carries
  // addresses and websites that the type-specific endpoints omit.
  const merged = new Map<string, { raw: AoeRawRecord; type: EntityType }>();

  const order: Array<keyof Snapshot['endpoints']> = [
    'supervisoryUnions',
    'unionDistricts',
    'towns',
    'publicSchools',
    'independentSchools',
    'organizations',
  ];

  for (const endpoint of order) {
    const records = snapshot.endpoints[endpoint as string] ?? [];
    for (const raw of records) {
      const id = orgId(raw);
      if (!id) {
        warnings.push(`${String(endpoint)}: record "${raw.Name ?? 'unnamed'}" has no OrgID/OrgId; skipped.`);
        continue;
      }
      const placeholder = detectPlaceholder({ id, name: raw.Name ?? null });
      if (placeholder.isPlaceholder) {
        warnings.push(
          `${String(endpoint)}: skipped a placeholder record — ${placeholder.reason}. ` +
            `Publishing it on a public registry page would invite readers to doubt ` +
            `everything else on the site. If this is a real organization, adjust ` +
            `detectPlaceholder in registry/placeholder.ts.`,
        );
        continue;
      }

      const type = entityTypeFromOrgType(raw.OrgType);
      if (!type) {
        const reason = untrackedReason(raw.OrgType);
        if (reason) {
          // A considered omission, not an anomaly. Still reported, so the
          // decision stays visible, but phrased as the decision it is.
          notTracked.push(
            `${String(endpoint)}: "${raw.Name ?? id}" is typed "${raw.OrgType}" and is not tracked. ${reason}`,
          );
        } else {
          warnings.push(
            `${String(endpoint)}: "${raw.Name ?? id}" has unrecognized OrgType "${raw.OrgType ?? 'none'}"; skipped. ` +
              `This is an entity type AOE has not published before. Add it to ORG_TYPE_TO_ENTITY ` +
              `in slugs.ts if it should be tracked, or to UNTRACKED_ORG_TYPES if it should not.`,
          );
        }
        continue;
      }
      const prior = merged.get(id);
      merged.set(id, {
        type: prior?.type ?? type,
        raw: prior ? { ...prior.raw, ...stripNulls(raw) } : raw,
      });
    }
  }

  // Closure dates arrive on their own endpoint, and closed entities are NOT
  // present in the live lists. Bringing them in is what makes the registry
  // bitemporal rather than merely current -- an SU that closed in 2021 stays
  // queryable, which is exactly what before/after merger lineage needs.
  for (const raw of snapshot.endpoints['closedOrganizations'] ?? []) {
    const id = orgId(raw);
    if (!id) continue;
    // A closed scratch record is still a scratch record. This endpoint is a
    // separate entry point into the registry and needs the same filter.
    if (detectPlaceholder({ id, name: raw.Name ?? null }).isPlaceholder) continue;
    const type = entityTypeFromOrgType(raw.OrgType);
    if (!type) continue;
    const prior = merged.get(id);
    merged.set(id, {
      type: prior?.type ?? type,
      raw: prior ? { ...prior.raw, ...stripNulls(raw) } : raw,
    });
  }

  // First pass: build entities and their slugs.
  const bySlug = new Map<string, RegistryEntity>();
  const slugByOrgId = new Map<string, string>();

  for (const [id, { raw, type }] of merged) {
    const name = raw.Name ?? id;
    const { slug } = assignSlug(type, name, id, existingByOrgId, taken);
    taken.add(slug);
    slugByOrgId.set(id, slug);

    const prior = existingBySlug.get(slug);
    const closeDate = closeDateOf(raw);

    const entity: RegistryEntity = {
      slug,
      name,
      type,
      aoe_org_id: id,
      aoe_server_id: raw.ServerId ?? null,
      edfi_id: raw.EdFi_ID ?? null,
      effective_from: prior?.effective_from ?? options.today,
      effective_from_basis: prior?.effective_from_basis ?? 'first_observed',
      effective_to: closeDate,
      effective_to_basis: closeDate ? 'aoe_published' : 'unknown',
      successor: prior?.successor ?? null,
      successor_basis: prior?.successor_basis ?? null,
      supervisory_union: null,
      operated_by: null,
      reporting_only: isReportingBucket({ id, name }),
      member_towns: [],
      grades: raw.Grades ?? [],
      website: raw.Website ?? null,
      latitude: parseCoordinate(raw.Latitude),
      longitude: parseCoordinate(raw.Longitude),
      ...schoolFields(type, raw, prior),
      // Generated by applyCorrections below, never carried over: the register
      // is the source of truth for what a human has asserted.
      manual_overrides: [],
      notes: prior?.notes ?? null,
    };

    bySlug.set(slug, entity);
  }

  // Second pass: relationships, now that every org ID has a slug to point at.
  const memberTowns = new Map<string, string[]>();

  for (const [id, { raw, type }] of merged) {
    const slug = slugByOrgId.get(id);
    if (!slug) continue;
    const entity = bySlug.get(slug);
    if (!entity) continue;

    const rel = relationshipsFor(type, raw);
    const rawSuSlug = rel.supervisory_union ? (slugByOrgId.get(rel.supervisory_union) ?? null) : null;
    const rawOpSlug = rel.operated_by ? (slugByOrgId.get(rel.operated_by) ?? null) : null;

    // Independent academies, tech centers and some state-run schools list
    // themselves in ParentOrg, the same way supervisory unions do. Recorded
    // literally that becomes "this academy's supervisory union is itself",
    // which would put it in its own hierarchy and let a scenario merge an
    // entity with itself. A self-reference means "no parent", so drop it.
    const suSlug = rawSuSlug === slug ? null : rawSuSlug;
    const opSlug = rawOpSlug === slug ? null : rawOpSlug;

    if (rel.supervisory_union && !suSlug) {
      warnings.push(
        `${entity.slug}: supervisory union "${rel.supervisory_union}" is not present in this snapshot.`,
      );
    }
    if (rel.operated_by && !opSlug) {
      warnings.push(
        `${entity.slug}: operating district "${rel.operated_by}" is not present in this snapshot.`,
      );
    }

    bySlug.set(slug, { ...entity, supervisory_union: suSlug, operated_by: opSlug });

    // A reporting bucket is deliberately excluded from member_towns: no ADM is
    // awarded to it, so listing it as a town a district serves would inflate
    // every downstream count that walks that list.
    if (type === 'town' && opSlug && !entity.reporting_only) {
      const list = memberTowns.get(opSlug) ?? [];
      list.push(slug);
      memberTowns.set(opSlug, list);
    }
  }

  for (const [districtSlug, towns] of memberTowns) {
    const district = bySlug.get(districtSlug);
    if (!district) continue;
    bySlug.set(districtSlug, { ...district, member_towns: towns.sort() });
  }

  // The register is applied last, over AOE's values. The API is a convenience
  // layer, not a dependency: a value a human asserted with evidence must
  // survive the next sync -- but only until AOE comes to agree with it, which
  // applyCorrections detects and retires on its own.
  const byCorrection = correctionsBySlug(options.corrections ?? []);
  const entities = [...bySlug.values()].map((entity) =>
    applyCorrections(entity, byCorrection.get(entity.slug) ?? []),
  );

  return {
    entities: entities.sort((a, b) => a.slug.localeCompare(b.slug)),
    warnings,
    notTracked: [...new Set(notTracked)].sort(),
  };
}

function stripNulls(raw: AoeRawRecord): AoeRawRecord {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as AoeRawRecord;
}

// --------------------------------------------------------------------------
// Diffing
// --------------------------------------------------------------------------

export type ChangeKind = 'added' | 'removed' | 'closed' | 'reopened' | 'modified';

export interface Change {
  readonly kind: ChangeKind;
  readonly slug: string;
  readonly name: string;
  readonly fields: readonly string[];
  readonly detail: string;
}

const DIFFED_FIELDS: ReadonlyArray<keyof RegistryEntity> = [
  'name',
  'type',
  'aoe_org_id',
  'effective_to',
  'supervisory_union',
  'operated_by',
  'member_towns',
  'grades',
  'website',
  // Without this, AOE moving a corrected field to some third value produces
  // no diffed field at all -- we hold our own value throughout, so nothing
  // else here changes -- and the one event a correction most needs a human to
  // notice (AOE diverged further, rather than agreeing) reads as "0 changes."
  'aoe_published',
];

/**
 * Diffs two registries. The output is the body of the nightly sync PR, and
 * incidentally a public changelog of Vermont district reorganization.
 */
export function diffRegistry(
  before: ReadonlyMap<string, RegistryEntity>,
  after: ReadonlyMap<string, RegistryEntity>,
): Change[] {
  const changes: Change[] = [];

  for (const [slug, entity] of after) {
    const prior = before.get(slug);
    if (!prior) {
      changes.push({
        kind: 'added',
        slug,
        name: entity.name,
        fields: [],
        detail: `New ${entity.type} "${entity.name}" (${entity.aoe_org_id ?? 'no AOE ID'}).`,
      });
      continue;
    }

    if (!prior.effective_to && entity.effective_to) {
      changes.push({
        kind: 'closed',
        slug,
        name: entity.name,
        fields: ['effective_to'],
        detail: `"${entity.name}" closed on ${entity.effective_to}.`,
      });
    } else if (prior.effective_to && !entity.effective_to) {
      changes.push({
        kind: 'reopened',
        slug,
        name: entity.name,
        fields: ['effective_to'],
        detail: `"${entity.name}" no longer carries a close date. Verify by hand -- this is more likely an upstream data correction than an actual reopening.`,
      });
    }

    const fields = DIFFED_FIELDS.filter((f) => {
      if (f === 'effective_to') return false;
      return JSON.stringify(prior[f]) !== JSON.stringify(entity[f]);
    });

    if (fields.length > 0) {
      changes.push({
        kind: 'modified',
        slug,
        name: entity.name,
        fields: fields as string[],
        detail: fields
          .map((f) => `${String(f)}: ${JSON.stringify(prior[f])} → ${JSON.stringify(entity[f])}`)
          .join('; '),
      });
    }
  }

  for (const [slug, entity] of before) {
    if (!after.has(slug)) {
      changes.push({
        kind: 'removed',
        slug,
        name: entity.name,
        fields: [],
        detail:
          `"${entity.name}" disappeared from the API without a close date. The registry ` +
          `keeps the record -- entities are closed, never deleted -- but this needs a human ` +
          `to determine whether it closed, merged, or the API simply dropped it.`,
      });
    }
  }

  return changes.sort((a, b) => a.slug.localeCompare(b.slug));
}
