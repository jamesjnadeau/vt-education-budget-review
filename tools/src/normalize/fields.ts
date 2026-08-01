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
  // Revenues by source.
  { path: 'revenues.education_fund', kind: 'money', accountable: true },
  { path: 'revenues.local', kind: 'money', accountable: true },
  { path: 'revenues.federal', kind: 'money', accountable: true },
  { path: 'revenues.other', kind: 'money', accountable: true },
  { path: 'revenues.total_stated', kind: 'money', accountable: false },
  // Expenditures by function.
  { path: 'expenditures.instruction', kind: 'money', accountable: true },
  { path: 'expenditures.special_education', kind: 'money', accountable: true },
  { path: 'expenditures.administration_district', kind: 'money', accountable: true },
  { path: 'expenditures.administration_school', kind: 'money', accountable: true },
  { path: 'expenditures.operations_maintenance', kind: 'money', accountable: true },
  { path: 'expenditures.transportation', kind: 'money', accountable: true },
  { path: 'expenditures.debt_service', kind: 'money', accountable: true },
  { path: 'expenditures.other', kind: 'money', accountable: true },
  { path: 'expenditures.total_stated', kind: 'money', accountable: false },
  // Personnel by object class.
  { path: 'personnel.total_staff_costs', kind: 'money', accountable: true },
  { path: 'personnel.salaries', kind: 'money', accountable: true },
  { path: 'personnel.benefits_health', kind: 'money', accountable: true },
  { path: 'personnel.benefits_other', kind: 'money', accountable: true },
  { path: 'personnel.fte.teachers', kind: 'fte', accountable: true },
  { path: 'personnel.fte.support_staff', kind: 'fte', accountable: true },
  { path: 'personnel.fte.administrators', kind: 'fte', accountable: true },
  { path: 'personnel.fte.total', kind: 'fte', accountable: true },
  { path: 'personnel.as_stated_note', kind: 'text', accountable: false },
  // Enrollment.
  { path: 'enrollment.adm', kind: 'number', accountable: true },
  { path: 'enrollment.adm_basis', kind: 'text', accountable: false },
  { path: 'enrollment.equalized_pupils_stated', kind: 'number', accountable: false },
  // Per pupil.
  { path: 'per_pupil.as_stated', kind: 'money', accountable: true },
  { path: 'per_pupil.as_stated_basis', kind: 'text', accountable: false },
  // Top-level note.
  { path: 'membership_note', kind: 'text', accountable: false },
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
