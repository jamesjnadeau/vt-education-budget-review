/**
 * Presentation helpers.
 *
 * Town names in particular: AOE publishes them in all caps ("BARRE CITY"),
 * which is a data-entry artifact of their system rather than the name of the
 * place. The registry keeps the value exactly as published, because the
 * registry's job is fidelity to the source. Casing it for display belongs
 * here, where it changes nothing about what is stored.
 */

const KEEP_UPPER = new Set(['ii', 'iii', 'iv']);
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

export function slugTail(slug: string): string {
  return slug.split('/')[1] ?? slug;
}

export function fyLabel(year: number): string {
  return `FY${String(year).slice(2)}`;
}
