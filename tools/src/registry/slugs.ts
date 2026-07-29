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
 * Head Start, alternative programs and the State of Vermont record itself are
 * deliberately not mapped. They warn and skip, which is visible in the sync
 * output -- an unmapped type should be a decision someone made, not a silence.
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

/** Maps the API's OrgType strings onto our entity types. */
export function entityTypeFromOrgType(orgType: string | undefined): EntityType | null {
  if (!orgType) return null;
  for (const [pattern, type] of ORG_TYPE_TO_ENTITY) {
    if (pattern.test(orgType)) return type;
  }
  return null;
}
