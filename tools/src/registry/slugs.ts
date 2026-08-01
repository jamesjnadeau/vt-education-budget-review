/**
 * Stable internal slugs.
 *
 * AOE organization IDs and names will churn as Act 170 mergers close in 2029.
 * Our URLs and our historical data must not. So a slug is assigned to an entity
 * ONCE, keyed off its AOE org ID, and thereafter is never recomputed from the
 * name -- an SU that gets renamed keeps its slug and gains a note, because
 * `/su/washington-central/` appearing in a committee packet has to keep
 * resolving in 2031.
 *
 * `assignSlugs` therefore takes the existing registry as input and only mints
 * slugs for org IDs it has never seen.
 */

import type { EntityType } from './types.ts';

const TYPE_PREFIX: Readonly<Record<EntityType, string>> = {
  su: 'su',
  sd: 'sd',
  ud: 'ud',
  school: 'school',
  town: 'town',
  academy: 'academy',
  techcenter: 'techcenter',
  independent: 'independent',
  state: 'state',
};

/**
 * A publisher of data rather than an organization in the registry.
 *
 * AOE publishes statewide datasets but has no organization record for itself,
 * so provenance for an AOE artifact has nothing valid to name. A `source/` slug
 * fills that gap without hand-authoring a registry record the generated sync
 * would be free to discard. It is part of the reference pattern below and is
 * exempted, explicitly, by each consumer that needs to exempt it.
 */
export const SOURCE_REF = /^source\/[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The one entity-reference pattern.
 *
 * It was three: this file's prefixes, a hand-copy in `validate/rules.ts`, and a
 * hand-copy in `registry/corrections-report.ts` — and the copies had already
 * drifted apart over `source`. That last copy is a LEAK GUARD (it decides
 * whether a corrections-report value is a repo slug that must be resolved to an
 * AOE identifier before it is emailed to AOE), so a forgotten copy is a repo
 * slug in outgoing correspondence with no test failing.
 *
 * Built from `TYPE_PREFIX` rather than written out, so a new entity type
 * updates every consumer by construction: `EntityType` makes the table entry
 * mandatory, and the pattern follows. `source` is appended because it is a
 * legal reference everywhere a slug is written, and because
 * `common-1.0.schema.json`'s `entity_ref` — the fourth copy, which JSON Schema
 * cannot import — includes it, and `registry.test.ts` pins the two together.
 *
 * The pattern SOURCE is exported beside the compiled regex because that is what
 * the schema copy can be compared against: `RegExp.prototype.source` escapes the
 * forward slash, so comparing against it would need a normalizing step, and a
 * drift guard that massages its inputs is a drift guard nobody trusts.
 */
export const ENTITY_REF_PATTERN = `^(${[...Object.values(TYPE_PREFIX), 'source'].join(
  '|',
)})/[a-z0-9]+(-[a-z0-9]+)*$`;

export const ENTITY_REF = new RegExp(ENTITY_REF_PATTERN);

/** Words stripped from names before slugging, because nearly every entity has them. */
const NOISE = [
  'supervisory union',
  'supervisory district',
  'unified union school district',
  'union school district',
  'unified school district',
  'community union school district',
  'school district',
  'incorporated school district',
];

export function slugifyName(name: string): string {
  let s = name.toLowerCase();

  // "#54" and "no. 54" are the only reliable disambiguator between districts
  // with near-identical names, so pull the number out before stripping noise
  // and re-attach it at the end.
  const numberMatch = s.match(/#\s*(\d+)|\bno\.?\s*(\d+)\b/);
  const number = numberMatch ? (numberMatch[1] ?? numberMatch[2]) : null;
  s = s.replace(/#\s*\d+|\bno\.?\s*\d+\b/g, ' ');

  for (const noise of NOISE) {
    s = s.replace(new RegExp(`\\b${noise}\\b`, 'g'), ' ');
  }

  s = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (number) s = s ? `${s}-${number}` : number;
  return s;
}

export function makeSlug(type: EntityType, name: string): string {
  const body = slugifyName(name);
  return `${TYPE_PREFIX[type]}/${body || 'unnamed'}`;
}

export interface SlugAssignment {
  readonly slug: string;
  readonly minted: boolean;
}

/**
 * Resolves an entity to its slug, reusing the existing one where the org ID is
 * already known and minting a unique new one otherwise.
 */
export function assignSlug(
  type: EntityType,
  name: string,
  aoeOrgId: string | null,
  existingByOrgId: ReadonlyMap<string, string>,
  taken: ReadonlySet<string>,
): SlugAssignment {
  if (aoeOrgId) {
    const existing = existingByOrgId.get(aoeOrgId);
    if (existing) return { slug: existing, minted: false };
  }

  const base = makeSlug(type, name);
  if (!taken.has(base)) return { slug: base, minted: true };

  // Collisions are rare but real -- two towns can share a name across the
  // state line, and district names repeat. Disambiguate with the AOE ID rather
  // than a bare counter, so the resulting slug is at least traceable.
  const suffix = aoeOrgId ? aoeOrgId.toLowerCase() : '2';
  let candidate = `${base}-${suffix}`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}-${n++}`;
  }
  return { slug: candidate, minted: true };
}

/**
 * The API's OrgType strings, mapped onto our entity types.
 *
 * The independent-school family is tracked rather than dropped because
 * Vermont town tuitioning is central to any merger conversation: a town that
 * operates no school of its own and tuitions its students has completely
 * different merger arithmetic from one that does, and the registry has to be
 * able to tell them apart. Vocational schools and joint contract districts are
 * likewise part of the public finance picture.
 *
 * Types we deliberately do not track are listed in UNTRACKED_ORG_TYPES below,
 * with the reason. They are skipped quietly-but-visibly; a type that appears
 * in neither list is a genuine surprise and gets a loud warning.
 */
const ORG_TYPE_TO_ENTITY: ReadonlyArray<readonly [RegExp, EntityType]> = [
  [/^Supervisory Union/i, 'su'],
  [/^Unified District/i, 'ud'],
  [/^Joint Contract District/i, 'sd'],
  [/^Towns?\/City/i, 'town'],
  [/^Public School/i, 'school'],
  [/^NH Public School/i, 'school'],
  [/^Private Academy/i, 'academy'],
  [/^Tech Center/i, 'techcenter'],
  [/^Vocational School/i, 'techcenter'],
  [/^State Run School/i, 'state'],
  // "Recognized School (IS)", "Independent School (IS)", "Approved Program (IS)",
  // "Distance Learning (IS)", "Approved Ind. Kindergarten (IS)".
  [/\(IS\)\s*$/i, 'independent'],
];

/**
 * Org types that exist in the API and that we deliberately do not track, with
 * the reason for each.
 *
 * Kept explicit and separate from "unrecognized" so the sync can tell a
 * considered omission from something genuinely new. An org type appearing in
 * neither list means AOE has started publishing a kind of entity we have never
 * seen, which is worth a loud warning; these are not.
 */
export const UNTRACKED_ORG_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /^Head Start/i,
    'Head Start grantees are early-childhood programs rather than school-finance ' +
      'entities. This typing is correct, not an upstream error: where a school district ' +
      'is itself a grantee it carries a separate HDS org ID, and the district, its town ' +
      'and its schools are already tracked under their own records — so nothing is lost.',
  ],
  [
    /^State of Vermont/i,
    'The state\'s own directory record is not a district and has no budget of the kind ' +
      'this warehouse holds.',
  ],
  [
    /^Alternative Program/i,
    'Alternative programs are operated within districts that are already tracked, and do ' +
      'not publish budgets of their own.',
  ],
];

/** Why an org type is deliberately not tracked, or null if it is not on the list. */
export function untrackedReason(orgType: string | undefined): string | null {
  if (!orgType) return null;
  for (const [pattern, reason] of UNTRACKED_ORG_TYPES) {
    if (pattern.test(orgType)) return reason;
  }
  return null;
}

/**
 * Specific organizations AOE publishes under a TRACKED OrgType but that are not
 * Vermont K-12 local education agencies, keyed by AOE org ID with the reason.
 *
 * `UNTRACKED_ORG_TYPES` above cannot catch these: AOE types both of them
 * "Supervisory Union (SU)", which is exactly the type a real supervisory union
 * carries, so the discriminator has to be identity, not type. It is the org ID
 * rather than the name because the ID is the stable key the whole registry is
 * built on -- names churn as mergers close (see this module's header) -- and
 * because a name match would risk a real district whose name happens to contain
 * one of these strings, while `HE001`/`SU099` name exactly one record each.
 *
 * Kept deliberately narrow and explicit, the same discipline as
 * `registry/placeholder.ts`: an exact org-ID match, one documented reason per
 * entry, and -- because the sync routes these to `notTracked` -- never a silent
 * drop. Left in the live SU lists, each would stand as a permanent red gap on
 * the coverage dashboard for a budget it will never publish.
 */
export const UNTRACKED_ORG_IDS: ReadonlyArray<readonly [string, string]> = [
  [
    'HE001',
    'The University of Vermont is a higher-education institution (the HE org-ID ' +
      'family), not a K-12 supervisory union. AOE lists it on the supervisory-union ' +
      'endpoint, but it operates no school district and publishes no school-district ' +
      'budget of the kind this warehouse holds.',
  ],
  [
    'SU099',
    'The Department of Corrections is a state agency that provides education inside ' +
      'correctional facilities (its grades are coded "AW", adult), not a K-12 ' +
      'supervisory union with member towns and a school-district budget. Its SU-range ' +
      'org ID is an upstream typing, not evidence of a district.',
  ],
];

/**
 * Why a specific organization is deliberately not tracked despite a tracked
 * OrgType, or null if its org ID is not on the list. See `UNTRACKED_ORG_IDS`.
 */
export function untrackedOrgIdReason(orgId: string | undefined): string | null {
  if (!orgId) return null;
  for (const [id, reason] of UNTRACKED_ORG_IDS) {
    if (id === orgId) return reason;
  }
  return null;
}

/** Maps the API's OrgType strings onto our entity types. */
export function entityTypeFromOrgType(orgType: string | undefined): EntityType | null {
  if (!orgType) return null;
  for (const [pattern, type] of ORG_TYPE_TO_ENTITY) {
    if (pattern.test(orgType)) return type;
  }
  return null;
}
