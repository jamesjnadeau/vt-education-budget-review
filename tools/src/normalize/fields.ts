/**
 * The figure fields of a budget record, and how a form value becomes one.
 *
 * The form labels its inputs with the record's own dotted paths
 * (`revenues.education_fund`), so there is no label-to-path mapping to drift:
 * this table IS the correspondence, and the issue form mirrors it. `accountable`
 * marks the figures the validator's null-accounting rule holds to account -- the
 * ones the form demands a number or the `n/p` sentinel for. The rest are
 * descriptive or a printed total, where a blank is a legitimate null.
 */

export type FigureKind = 'money' | 'fte' | 'number' | 'text';

export interface FigureField {
  readonly path: string;
  readonly kind: FigureKind;
  readonly accountable: boolean;
}

export const STATUSES = ['proposed', 'warned', 'approved', 'actual'] as const;

export const FIGURE_FIELDS: readonly FigureField[] = [
  { path: 'revenues.education_fund', kind: 'money', accountable: true },
  { path: 'revenues.education_fund_previous_year_actual', kind: 'money', accountable: true },
  { path: 'revenues.total_stated', kind: 'money', accountable: true },
  { path: 'expenditures.total_stated', kind: 'money', accountable: true },
  { path: 'expenditures.previous_year_actual', kind: 'money', accountable: true },
];

export type FigureParse = { value: number } | { notPublished: true } | { error: string };

const SENTINEL = /^n\/p$/i;

/**
 * A form figure as a number, the not-published sentinel, or an error. Accepts a
 * leading `$` and thousands commas because that is how budgets print money. An
 * empty value is an error, never a silent null -- deciding is the whole point.
 */
export function parseFigure(raw: string): FigureParse {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'is blank; enter a number or n/p' };
  if (SENTINEL.test(trimmed)) return { notPublished: true };
  const cleaned = trimmed.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  if (cleaned === '' || !Number.isFinite(n)) {
    return { error: `"${trimmed}" is neither a number nor n/p` };
  }
  return { value: n };
}

/** Assigns `value` at a dotted path, creating intermediate objects. */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1] as string] = value;
}
