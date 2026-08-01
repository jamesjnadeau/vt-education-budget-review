/**
 * Parsing the per-town tax textarea.
 *
 * Issue forms have no repeatable-group field and `tax.towns` is a variable-length
 * array, so member-town figures come in as one line per town,
 * `slug, homestead_rate, cla`, with each rate a number or the `n/p` sentinel. A
 * lone `n/p` records that the document publishes no per-town table at all; an
 * empty textarea is an error, because "no town table" is a decision to state,
 * not a blank to pass over.
 */

import { parseFigure } from './fields.ts';

export interface TownTax {
  readonly town: string;
  readonly homestead_rate_stated: number | null;
  readonly cla: number | null;
}

export type TaxParse = { ok: true; towns: TownTax[] } | { ok: false; errors: string[] };

function cell(raw: string): { value: number | null } | { error: string } {
  const parsed = parseFigure(raw);
  if ('error' in parsed) return { error: parsed.error };
  return { value: 'notPublished' in parsed ? null : parsed.value };
}

export function parseTaxTable(text: string, knownSlugs: ReadonlySet<string>): TaxParse {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, errors: ['the tax table is blank; list one town per line, or n/p for no per-town rates'] };
  }
  if (/^n\/p$/i.test(trimmed)) return { ok: true, towns: [] };

  const errors: string[] = [];
  const towns: TownTax[] = [];

  for (const line of trimmed.split('\n')) {
    if (line.trim() === '') continue;
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length !== 3) {
      errors.push(`"${line.trim()}" is not "slug, homestead_rate, cla" (three comma-separated columns)`);
      continue;
    }
    const [slug, rateRaw, claRaw] = parts as [string, string, string];
    if (!knownSlugs.has(slug)) {
      errors.push(`town "${slug}" is not a known registry entity`);
      continue;
    }
    const rate = cell(rateRaw);
    const cla = cell(claRaw);
    if ('error' in rate) errors.push(`${slug} homestead rate ${rate.error}`);
    if ('error' in cla) errors.push(`${slug} cla ${cla.error}`);
    if ('error' in rate || 'error' in cla) continue;
    towns.push({ town: slug, homestead_rate_stated: rate.value, cla: cla.value });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, towns };
}
