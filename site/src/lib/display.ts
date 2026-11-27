/**
 * Presentation helpers.
 *
 * Town names in particular: AOE publishes them in all caps ("BARRE CITY"),
 * which is a data-entry artifact of their system rather than the name of the
 * place. The registry keeps the value exactly as published, because the
 * registry's job is fidelity to the source. Casing it for display belongs
 * here, where it changes nothing about what is stored.
 */

const KEEP_UPPER = new Set(['ii', 'iii', 'iv', 'nh', 'id']);
const KEEP_LOWER = new Set(['of', 'the', 'and', 'at', 'in', 'on']);

export function titleCase(name: string): string {
  // Only intervene when the source is shouting. A correctly-cased name is
  // left completely alone.
  if (name !== name.toUpperCase()) return name;

  return name
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((part, index) => {
      if (/^(\s+|-|\/)$/.test(part)) return part;
      if (index > 0 && KEEP_LOWER.has(part)) return part;
      if (KEEP_UPPER.has(part)) return part.toUpperCase();
      // "st." -> "St.", "mcdonald" is left as "Mcdonald" rather than guessed at.
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/** A town whose name ends in a non-Vermont state code, such as ORFORD NH. */
export function isOutOfState(e: { name: string }): boolean {
  return / (NH|NY|MA)$/.test(e.name.trim());
}

/**
 * The reader-facing name for a registry slug. Never the raw id. A null or
 * unknown slug is a blank we have not checked yet.
 */
export function entityLabel(slug: string | null, entities: { slug: string; name: string }[]): string {
  if (!slug) return 'not checked yet';
  const found = entities.find((e) => e.slug === slug);
  return found ? titleCase(found.name) : 'not checked yet';
}

/**
 * Where an operator's own page lives, or null when none is built.
 * `districtPages` holds the slugs of the built /my/district/ pages (the keys
 * of buildJourney().districts, which have no type prefix). A district page
 * wins over a town or union page. Union and town pages are always built.
 */
export function operatorHref(
  slug: string | null,
  districtPages: ReadonlySet<string>,
  base: string,
): string | null {
  if (!slug) return null;
  const [kind, tail] = slug.split('/');
  if (!tail) return null;
  if ((kind === 'ud' || kind === 'town') && districtPages.has(tail)) return `${base}/my/district/${tail}/`;
  if (kind === 'town' || kind === 'su') return `${base}/${kind}/${tail}/`;
  return null;
}

export function slugTail(slug: string): string {
  return slug.split('/')[1] ?? slug;
}

export function fyLabel(year: number): string {
  return `FY${String(year).slice(2)}`;
}
